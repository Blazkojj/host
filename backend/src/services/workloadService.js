import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { env, runtimePaths } from "../config/env.js";
import { query } from "../db.js";
import { buildImage, docker, ensureDockerNetwork, inspectImage } from "../docker.js";
import { assertUserCanHost, assertWithinQuota } from "./quotaService.js";
import { getTemplate, listTemplates } from "./templates.js";
import { ApiError } from "../utils/apiError.js";
import { detectRuntime } from "../utils/detectRuntime.js";
import { generateBotDockerfile } from "../utils/dockerfile.js";
import { ensureDir, extractZipSafely, removeIfExists, writeTextFile } from "../utils/fs.js";
import { slugify } from "../utils/slug.js";

const botSchema = z.object({
  name: z.string().min(2).max(64),
  startupCommand: z.string().min(1).max(300).optional(),
  envLines: z.string().max(8000).optional(),
  ports: z.string().max(4000).optional(),
  autoRestart: z.coerce.boolean().default(true),
  memoryMb: z.coerce.number().int().min(128).max(65536),
  cpuLimit: z.coerce.number().min(0.25).max(64),
  storageMb: z.coerce.number().int().min(512).max(512000)
});

const serverSchema = z.object({
  name: z.string().min(2).max(64),
  templateKey: z.string().min(2).max(64),
  envLines: z.string().max(8000).optional(),
  autoRestart: z.coerce.boolean().default(true),
  memoryMb: z.coerce.number().int().min(512).max(65536),
  cpuLimit: z.coerce.number().min(0.5).max(64),
  storageMb: z.coerce.number().int().min(1024).max(512000)
});

const parseEnvLines = (rawLines = "") => {
  const envObject = {};

  rawLines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const index = line.indexOf("=");

      if (index <= 0) {
        throw new ApiError(400, `Invalid environment variable line: ${line}`);
      }

      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1);

      if (!/^[A-Z0-9_]+$/i.test(key)) {
        throw new ApiError(400, `Invalid environment variable key: ${key}`);
      }

      envObject[key] = value;
    });

  return envObject;
};

const parsePorts = (rawPorts = "") => {
  if (!rawPorts.trim()) {
    return [];
  }

  return rawPorts
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [mapping, protocolRaw] = line.split("/");
      const protocol = (protocolRaw || "tcp").toLowerCase();
      const [hostPortRaw, containerPortRaw] = mapping.split(":");
      const containerPort = Number(containerPortRaw || hostPortRaw);
      const hostPort = Number(containerPortRaw ? hostPortRaw : 0);

      if (!Number.isInteger(containerPort) || containerPort < 1 || containerPort > 65535) {
        throw new ApiError(400, `Invalid container port in "${line}".`);
      }

      if (hostPort && (!Number.isInteger(hostPort) || hostPort < 1 || hostPort > 65535)) {
        throw new ApiError(400, `Invalid host port in "${line}".`);
      }

      if (!["tcp", "udp"].includes(protocol)) {
        throw new ApiError(400, `Unsupported port protocol in "${line}".`);
      }

      return {
        hostPort: hostPort || null,
        containerPort,
        protocol
      };
    });
};

const formatEnvArray = (envMap) => Object.entries(envMap).map(([key, value]) => `${key}=${value}`);

const countAutoPorts = (definitions) => definitions.filter((item) => !item.hostPort).length;

const allocatePorts = async (definitions) => {
  const dbResult = await query(
    `
      SELECT port_bindings
      FROM workloads
      WHERE status <> 'deleted'
    `
  );

  const used = new Set();

  for (const row of dbResult.rows) {
    for (const binding of row.port_bindings || []) {
      if (binding.hostPort) {
        used.add(Number(binding.hostPort));
      }
    }
  }

  for (const definition of definitions) {
    if (definition.hostPort && used.has(Number(definition.hostPort))) {
      throw new ApiError(409, `Host port ${definition.hostPort} is already in use.`);
    }

    if (definition.hostPort) {
      used.add(Number(definition.hostPort));
    }
  }

  const autoCount = countAutoPorts(definitions);
  const allocated = [];
  let pointer = env.portRangeStart;

  while (allocated.length < autoCount && pointer <= env.portRangeEnd) {
    if (!used.has(pointer)) {
      allocated.push(pointer);
      used.add(pointer);
    }

    pointer += 1;
  }

  if (allocated.length !== autoCount) {
    throw new ApiError(409, "No free public ports available in the configured range.");
  }

  let allocatedIndex = 0;

  return definitions.map((definition) => {
    if (definition.hostPort) {
      return {
        ...definition,
        hostPort: Number(definition.hostPort)
      };
    }

    const hostPort = allocated[allocatedIndex];
    allocatedIndex += 1;

    return {
      ...definition,
      hostPort
    };
  });
};

const createExposedPorts = (bindings) =>
  bindings.reduce((acc, item) => {
    acc[`${item.containerPort}/${item.protocol}`] = {};
    return acc;
  }, {});

const createPortBindings = (bindings) =>
  bindings.reduce((acc, item) => {
    acc[`${item.containerPort}/${item.protocol}`] = [{ HostPort: String(item.hostPort) }];
    return acc;
  }, {});

const ensureTemplateImage = async (template) => {
  const existing = await inspectImage(template.imageTag);

  if (existing) {
    return template.imageTag;
  }

  await fs.access(template.buildContext);
  await buildImage({
    contextPath: template.buildContext,
    tag: template.imageTag
  });

  return template.imageTag;
};

const synchronizeWorkload = async (workload) => {
  if (!workload.container_id) {
    return workload;
  }

  try {
    const inspection = await docker.getContainer(workload.container_id).inspect();
    const nextStatus = inspection.State.Running ? "running" : inspection.State.Status || workload.status;

    if (nextStatus !== workload.status) {
      await query(`UPDATE workloads SET status = $2, updated_at = NOW() WHERE id = $1`, [workload.id, nextStatus]);
    }

    return {
      ...workload,
      status: nextStatus
    };
  } catch (error) {
    if (error.statusCode === 404) {
      await query(
        `
          UPDATE workloads
          SET status = 'missing',
              last_error = 'Container not found in Docker daemon.',
              updated_at = NOW()
          WHERE id = $1
        `,
        [workload.id]
      );

      return {
        ...workload,
        status: "missing",
        last_error: "Container not found in Docker daemon."
      };
    }

    throw error;
  }
};

const prepareWorkloadDirs = async (workloadId) => {
  const root = path.join(runtimePaths.workloads, workloadId);
  const sourcePath = path.join(root, "source");
  const dataPath = path.join(root, "data");

  await ensureDir(sourcePath);
  await ensureDir(dataPath);

  return { root, sourcePath, dataPath };
};

const createContainer = async ({
  workloadId,
  userId,
  name,
  kind,
  image,
  envMap,
  bindings,
  memoryMb,
  cpuLimit,
  storageMb,
  autoRestart,
  binds,
  startupCommand
}) => {
  await ensureDockerNetwork();

  const containerName = `${kind}-${slugify(name)}-${workloadId.slice(0, 8)}`;
  const container = await docker.createContainer({
    name: containerName,
    Image: image,
    Tty: true,
    Env: formatEnvArray(envMap),
    ExposedPorts: createExposedPorts(bindings),
    Cmd: startupCommand ? ["sh", "-lc", startupCommand] : undefined,
    Labels: {
      "host.platform": "true",
      "host.workloadId": workloadId,
      "host.userId": userId,
      "host.kind": kind
    },
    HostConfig: {
      Binds: binds,
      PortBindings: createPortBindings(bindings),
      NetworkMode: env.dockerNetworkName,
      RestartPolicy: { Name: autoRestart ? "unless-stopped" : "no" },
      Memory: memoryMb * 1024 * 1024,
      NanoCpus: Math.round(cpuLimit * 1_000_000_000),
      StorageOpt: {
        size: `${storageMb}m`
      },
      LogConfig: {
        Type: "json-file",
        Config: {
          "max-size": "10m",
          "max-file": "3"
        }
      },
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges:true"],
      PidsLimit: 256,
      Tmpfs: {
        "/tmp": "rw,noexec,nosuid,size=64m"
      }
    }
  });

  await container.start();
  return { container, containerName };
};

const assertOwnership = (workload, user) => {
  if (!workload) {
    throw new ApiError(404, "Workload not found.");
  }

  if (user.role === "admin") {
    return;
  }

  if (workload.user_id !== user.id) {
    throw new ApiError(404, "Workload not found.");
  }
};

export const getWorkloadById = async (workloadId) => {
  const result = await query(`SELECT * FROM workloads WHERE id = $1`, [workloadId]);
  return result.rows[0] || null;
};

export const listUserWorkloads = async (userId) => {
  const result = await query(
    `
      SELECT *
      FROM workloads
      WHERE user_id = $1
        AND status <> 'deleted'
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return Promise.all(result.rows.map(synchronizeWorkload));
};

export const listAllWorkloads = async () => {
  const result = await query(
    `
      SELECT workloads.*, users.email AS owner_email
      FROM workloads
      INNER JOIN users ON users.id = workloads.user_id
      WHERE workloads.status <> 'deleted'
      ORDER BY workloads.created_at DESC
    `
  );

  return Promise.all(
    result.rows.map(async (row) => {
      const synced = await synchronizeWorkload(row);

      return {
        ...synced,
        owner_email: row.owner_email
      };
    })
  );
};

export const listTemplatesForApi = () =>
  listTemplates().map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    defaultEnv: template.defaultEnv,
    ports: template.ports
  }));

export const createBotWorkload = async ({ user, input, archiveFile }) => {
  if (!archiveFile) {
    throw new ApiError(400, "ZIP archive is required.");
  }

  const parsed = botSchema.parse(input);

  await assertWithinQuota({
    user,
    kind: "bot",
    memoryMb: parsed.memoryMb,
    cpuLimit: parsed.cpuLimit,
    storageMb: parsed.storageMb
  });

  const workloadId = crypto.randomUUID();
  const directories = await prepareWorkloadDirs(workloadId);

  try {
    await extractZipSafely(archiveFile.path, directories.sourcePath);

    const detected = await detectRuntime(directories.sourcePath);
    const runtime = detected.runtime;
    const startupCommand = parsed.startupCommand || detected.startupCommand;
    const envMap = parseEnvLines(parsed.envLines || "");
    const bindings = await allocatePorts(parsePorts(parsed.ports || ""));
    const dockerfile = generateBotDockerfile({ runtime, startupCommand });

    await writeTextFile(path.join(directories.sourcePath, "Dockerfile"), dockerfile);
    await writeTextFile(path.join(directories.sourcePath, ".dockerignore"), "node_modules\n__pycache__\n.git\n");

    const image = `host-bot-${workloadId}:latest`;
    await buildImage({
      contextPath: directories.sourcePath,
      tag: image
    });

    const { container, containerName } = await createContainer({
      workloadId,
      userId: user.id,
      name: parsed.name,
      kind: "bot",
      image,
      envMap,
      bindings,
      memoryMb: parsed.memoryMb,
      cpuLimit: parsed.cpuLimit,
      storageMb: parsed.storageMb,
      autoRestart: parsed.autoRestart,
      binds: [`${directories.dataPath}:/srv/app/data`],
      startupCommand
    });

    const inserted = await query(
      `
        INSERT INTO workloads (
          id,
          user_id,
          name,
          kind,
          runtime,
          image,
          container_name,
          container_id,
          upload_name,
          source_path,
          data_path,
          startup_command,
          env,
          port_bindings,
          status,
          auto_restart,
          memory_mb,
          cpu_limit,
          storage_mb
        )
        VALUES (
          $1, $2, $3, 'bot', $4, $5, $6, $7, $8, $9, $10, $11,
          $12::jsonb, $13::jsonb, 'running', $14, $15, $16, $17
        )
        RETURNING *
      `,
      [
        workloadId,
        user.id,
        parsed.name,
        runtime,
        image,
        containerName,
        container.id,
        archiveFile.originalname,
        directories.sourcePath,
        directories.dataPath,
        startupCommand,
        JSON.stringify(envMap),
        JSON.stringify(bindings),
        parsed.autoRestart,
        parsed.memoryMb,
        parsed.cpuLimit,
        parsed.storageMb
      ]
    );

    return inserted.rows[0];
  } catch (error) {
    await removeIfExists(directories.root);
    throw error;
  } finally {
    await removeIfExists(archiveFile.path);
  }
};

export const createServerWorkload = async ({ user, input }) => {
  const parsed = serverSchema.parse(input);
  const template = getTemplate(parsed.templateKey);

  if (!template) {
    throw new ApiError(404, "Unknown game server template.");
  }

  await assertWithinQuota({
    user,
    kind: "server",
    memoryMb: parsed.memoryMb,
    cpuLimit: parsed.cpuLimit,
    storageMb: parsed.storageMb
  });

  const workloadId = crypto.randomUUID();
  const directories = await prepareWorkloadDirs(workloadId);

  try {
    const image = await ensureTemplateImage(template);
    const envMap = {
      ...template.defaultEnv,
      ...parseEnvLines(parsed.envLines || "")
    };
    const bindings = await allocatePorts(template.ports.map((item) => ({ ...item, hostPort: null })));

    const { container, containerName } = await createContainer({
      workloadId,
      userId: user.id,
      name: parsed.name,
      kind: "server",
      image,
      envMap,
      bindings,
      memoryMb: parsed.memoryMb,
      cpuLimit: parsed.cpuLimit,
      storageMb: parsed.storageMb,
      autoRestart: parsed.autoRestart,
      binds: [`${directories.dataPath}:${template.mountPath}`]
    });

    const inserted = await query(
      `
        INSERT INTO workloads (
          id,
          user_id,
          name,
          kind,
          template_key,
          image,
          container_name,
          container_id,
          source_path,
          data_path,
          env,
          port_bindings,
          status,
          auto_restart,
          memory_mb,
          cpu_limit,
          storage_mb
        )
        VALUES (
          $1, $2, $3, 'server', $4, $5, $6, $7, $8, $9,
          $10::jsonb, $11::jsonb, 'running', $12, $13, $14, $15
        )
        RETURNING *
      `,
      [
        workloadId,
        user.id,
        parsed.name,
        parsed.templateKey,
        image,
        containerName,
        container.id,
        template.buildContext,
        directories.dataPath,
        JSON.stringify(envMap),
        JSON.stringify(bindings),
        parsed.autoRestart,
        parsed.memoryMb,
        parsed.cpuLimit,
        parsed.storageMb
      ]
    );

    return inserted.rows[0];
  } catch (error) {
    await removeIfExists(directories.root);
    throw error;
  }
};

export const startWorkload = async ({ workloadId, user }) => {
  const workload = await getWorkloadById(workloadId);
  assertOwnership(workload, user);
  assertUserCanHost(user);
  await docker.getContainer(workload.container_id).start();
  await query(`UPDATE workloads SET status = 'running', updated_at = NOW() WHERE id = $1`, [workloadId]);
  return getWorkloadById(workloadId);
};

export const stopWorkload = async ({ workloadId, user }) => {
  const workload = await getWorkloadById(workloadId);
  assertOwnership(workload, user);
  try {
    await docker.getContainer(workload.container_id).stop({ t: 15 });
  } catch (error) {
    if (error.statusCode !== 304) {
      throw error;
    }
  }
  await query(`UPDATE workloads SET status = 'stopped', updated_at = NOW() WHERE id = $1`, [workloadId]);
  return getWorkloadById(workloadId);
};

export const restartWorkload = async ({ workloadId, user }) => {
  const workload = await getWorkloadById(workloadId);
  assertOwnership(workload, user);
  assertUserCanHost(user);
  await docker.getContainer(workload.container_id).restart({ t: 15 });
  await query(`UPDATE workloads SET status = 'running', updated_at = NOW() WHERE id = $1`, [workloadId]);
  return getWorkloadById(workloadId);
};

export const deleteWorkload = async ({ workloadId, user }) => {
  const workload = await getWorkloadById(workloadId);
  assertOwnership(workload, user);

  if (workload.container_id) {
    const container = docker.getContainer(workload.container_id);

    try {
      await container.stop({ t: 10 });
    } catch (error) {
      if (![304, 404].includes(error.statusCode)) {
        throw error;
      }
    }

    try {
      await container.remove({ force: true });
    } catch (error) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }
  }

  if (workload.kind === "bot") {
    try {
      await docker.getImage(workload.image).remove({ force: true });
    } catch (error) {
      if (error.statusCode !== 404) {
        throw error;
      }
    }
  }

  if (workload.data_path) {
    await removeIfExists(path.dirname(workload.data_path));
  }

  await query(`UPDATE workloads SET status = 'deleted', updated_at = NOW() WHERE id = $1`, [workloadId]);
  return { success: true };
};

export const fetchLogSnapshot = async ({ workloadId, user, tail = 200 }) => {
  const workload = await getWorkloadById(workloadId);
  assertOwnership(workload, user);

  const logs = await docker.getContainer(workload.container_id).logs({
    stdout: true,
    stderr: true,
    timestamps: true,
    tail,
    follow: false
  });

  return logs.toString("utf8");
};

const getCpuPercent = (stats) => {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;

  if (systemDelta <= 0 || cpuDelta <= 0) {
    return 0;
  }

  return (cpuDelta / systemDelta) * cpuCount * 100;
};

export const getAdminContainerOverview = async () => {
  const workloads = await listAllWorkloads();

  return Promise.all(
    workloads.map(async (workload) => {
      if (!workload.container_id || ["deleted", "missing"].includes(workload.status)) {
        return workload;
      }

      try {
        const stats = await docker.getContainer(workload.container_id).stats({ stream: false });

        return {
          ...workload,
          metrics: {
            memoryBytes: stats.memory_stats.usage || 0,
            memoryLimitBytes: stats.memory_stats.limit || 0,
            cpuPercent: Number(getCpuPercent(stats).toFixed(2))
          }
        };
      } catch {
        return workload;
      }
    })
  );
};

export const getOverviewStats = async () => {
  const usersResult = await query(`
    SELECT
      COUNT(*)::INTEGER AS total_users,
      COUNT(*) FILTER (WHERE role = 'admin')::INTEGER AS admins,
      COUNT(*) FILTER (WHERE blocked = true)::INTEGER AS blocked_users
    FROM users
  `);

  const workloadsResult = await query(`
    SELECT
      COUNT(*)::INTEGER AS total_workloads,
      COUNT(*) FILTER (WHERE kind = 'bot')::INTEGER AS bots,
      COUNT(*) FILTER (WHERE kind = 'server')::INTEGER AS servers,
      COUNT(*) FILTER (WHERE status = 'running')::INTEGER AS running
    FROM workloads
    WHERE status <> 'deleted'
  `);

  return {
    ...usersResult.rows[0],
    ...workloadsResult.rows[0]
  };
};
