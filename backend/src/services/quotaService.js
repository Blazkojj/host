import { query } from "../db.js";
import { ApiError } from "../utils/apiError.js";

export const assertUserCanHost = (user) => {
  if (!user) {
    throw new ApiError(401, "User not found.");
  }

  if (user.blocked) {
    throw new ApiError(403, "User account is blocked.");
  }

  if (!user.can_hosting) {
    throw new ApiError(403, "Hosting is disabled for this user.");
  }

  if (user.hosting_expires_at && new Date(user.hosting_expires_at).getTime() < Date.now()) {
    throw new ApiError(403, "Hosting entitlement has expired.");
  }
};

export const assertWithinQuota = async ({ user, kind, memoryMb, cpuLimit, storageMb }) => {
  assertUserCanHost(user);

  const result = await query(
    `
      SELECT
        COUNT(*) FILTER (WHERE kind = 'bot')::INTEGER AS bots_count,
        COUNT(*) FILTER (WHERE kind = 'server')::INTEGER AS servers_count,
        COALESCE(SUM(memory_mb), 0)::INTEGER AS ram_total,
        COALESCE(SUM(cpu_limit), 0)::NUMERIC AS cpu_total,
        COALESCE(SUM(storage_mb), 0)::INTEGER AS storage_total
      FROM workloads
      WHERE user_id = $1
        AND status <> 'deleted'
    `,
    [user.id]
  );

  const totals = result.rows[0];
  const nextBots = Number(totals.bots_count) + (kind === "bot" ? 1 : 0);
  const nextServers = Number(totals.servers_count) + (kind === "server" ? 1 : 0);
  const nextRam = Number(totals.ram_total) + memoryMb;
  const nextCpu = Number(totals.cpu_total) + Number(cpuLimit);
  const nextStorage = Number(totals.storage_total) + storageMb;

  if (kind === "bot" && nextBots > user.max_bots) {
    throw new ApiError(403, `Bot limit exceeded. Allowed: ${user.max_bots}.`);
  }

  if (kind === "server" && nextServers > user.max_servers) {
    throw new ApiError(403, `Game server limit exceeded. Allowed: ${user.max_servers}.`);
  }

  if (nextRam > user.max_ram_mb) {
    throw new ApiError(403, `RAM quota exceeded. Requested total ${nextRam} MB, allowed ${user.max_ram_mb} MB.`);
  }

  if (nextCpu > Number(user.max_cpu)) {
    throw new ApiError(403, `CPU quota exceeded. Requested total ${nextCpu}, allowed ${user.max_cpu}.`);
  }

  if (nextStorage > user.max_storage_mb) {
    throw new ApiError(403, `Storage quota exceeded. Requested total ${nextStorage} MB, allowed ${user.max_storage_mb} MB.`);
  }
};
