import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../db.js";
import { docker } from "../docker.js";

const activeStreams = new Map();

const stopStream = (socketId) => {
  const stream = activeStreams.get(socketId);

  if (stream) {
    stream.destroy();
    activeStreams.delete(socketId);
  }
};

export const registerLogGateway = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        throw new Error("Missing socket token.");
      }

      const payload = jwt.verify(token, env.jwtSecret);
      const result = await query(`SELECT id, email, role FROM users WHERE id = $1`, [payload.sub]);

      if (result.rowCount === 0) {
        throw new Error("User not found.");
      }

      socket.user = result.rows[0];
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on("connection", (socket) => {
    socket.on("logs:subscribe", async ({ workloadId }) => {
      try {
        stopStream(socket.id);

        const result = await query(`SELECT * FROM workloads WHERE id = $1`, [workloadId]);
        const workload = result.rows[0];

        if (!workload) {
          socket.emit("logs:error", { message: "Workload not found." });
          return;
        }

        if (socket.user.role !== "admin" && workload.user_id !== socket.user.id) {
          socket.emit("logs:error", { message: "Access denied." });
          return;
        }

        const container = docker.getContainer(workload.container_id);
        const history = await container.logs({
          stdout: true,
          stderr: true,
          timestamps: true,
          tail: 100,
          follow: false
        });

        socket.emit("logs:chunk", history.toString("utf8"));

        const stream = await container.logs({
          stdout: true,
          stderr: true,
          timestamps: true,
          tail: 0,
          follow: true
        });

        activeStreams.set(socket.id, stream);

        stream.on("data", (chunk) => {
          socket.emit("logs:chunk", chunk.toString("utf8"));
        });

        stream.on("error", (error) => {
          socket.emit("logs:error", { message: error.message });
        });
      } catch (error) {
        socket.emit("logs:error", { message: error.message });
      }
    });

    socket.on("logs:unsubscribe", () => {
      stopStream(socket.id);
    });

    socket.on("disconnect", () => {
      stopStream(socket.id);
    });
  });
};
