import dotenv from "dotenv";
import path from "path";

dotenv.config();

const number = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const required = (name, fallback = undefined) => {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: number(process.env.PORT, 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET", "replace-me"),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost",
  runtimeRoot: process.env.RUNTIME_ROOT || "/srv/runtime",
  templateImagesRoot: process.env.TEMPLATE_IMAGES_ROOT || "/srv/templates",
  uploadLimitMb: number(process.env.UPLOAD_LIMIT_MB, 200),
  portRangeStart: number(process.env.PORT_RANGE_START, 25565),
  portRangeEnd: number(process.env.PORT_RANGE_END, 29999),
  adminEmail: process.env.ADMIN_EMAIL || "froblaz@wp.pl",
  adminPassword: process.env.ADMIN_PASSWORD || "Blazej0112",
  dockerSocketPath: process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock",
  dockerNetworkName: process.env.DOCKER_NETWORK_NAME || "hosting-runtime"
};

export const runtimePaths = {
  root: env.runtimeRoot,
  uploads: path.join(env.runtimeRoot, "uploads"),
  workloads: path.join(env.runtimeRoot, "workloads"),
  temp: path.join(env.runtimeRoot, "temp")
};
