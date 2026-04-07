import http from "http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";
import { env, runtimePaths } from "./config/env.js";
import { closeDatabase, migrate, pingDatabase, seedAdmin } from "./db.js";
import { ensureDockerNetwork, pingDocker } from "./docker.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import systemRoutes from "./routes/system.routes.js";
import workloadsRoutes from "./routes/workloads.routes.js";
import { registerLogGateway } from "./services/logGateway.js";
import { ensureDir } from "./utils/fs.js";

const bootstrap = async () => {
  await ensureDir(runtimePaths.root);
  await ensureDir(runtimePaths.uploads);
  await ensureDir(runtimePaths.workloads);
  await ensureDir(runtimePaths.temp);

  await pingDatabase();
  await migrate();
  await seedAdmin();
  await pingDocker();
  await ensureDockerNetwork();

  const app = express();
  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  );
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("combined"));

  app.use("/api/auth", authRoutes);
  app.use("/api/workloads", workloadsRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/system", systemRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: env.corsOrigin
    }
  });

  registerLogGateway(io);

  server.listen(env.port, () => {
    console.log(`Hostpanel backend listening on ${env.port}`);
  });

  const shutdown = async () => {
    console.log("Graceful shutdown started.");
    io.close();
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

bootstrap().catch((error) => {
  console.error("Fatal bootstrap error:", error);
  process.exit(1);
});
