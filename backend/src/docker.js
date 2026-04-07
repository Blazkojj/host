import tar from "tar-fs";
import Docker from "dockerode";
import { env } from "./config/env.js";

export const docker = new Docker({
  socketPath: env.dockerSocketPath
});

export const pingDocker = async () => {
  await docker.ping();
};

export const ensureDockerNetwork = async () => {
  const existing = await docker.listNetworks({
    filters: {
      name: [env.dockerNetworkName]
    }
  });

  if (existing.length > 0) {
    return existing[0];
  }

  return docker.createNetwork({
    Name: env.dockerNetworkName,
    Driver: "bridge",
    Labels: {
      "host.platform": "true"
    }
  });
};

const followProgress = async (stream) =>
  new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (error, output) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(output);
    });
  });

export const buildImage = async ({ contextPath, tag, dockerfile = "Dockerfile", buildargs = {} }) => {
  const stream = await docker.buildImage(tar.pack(contextPath), {
    t: tag,
    dockerfile,
    buildargs,
    networkmode: "bridge"
  });

  await followProgress(stream);
  return tag;
};

export const inspectImage = async (tag) => {
  try {
    return await docker.getImage(tag).inspect();
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }

    throw error;
  }
};
