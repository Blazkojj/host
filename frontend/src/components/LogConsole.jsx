import { useEffect, useState } from "react";
import { createLogsSocket } from "../api/client";

export default function LogConsole({ token, workloadId }) {
  const [content, setContent] = useState("Select a workload to start log streaming.");

  useEffect(() => {
    if (!token || !workloadId) {
      setContent("Select a workload to start log streaming.");
      return undefined;
    }

    const socket = createLogsSocket(token);
    setContent("Connecting to Docker logs...\n");

    socket.on("connect", () => {
      socket.emit("logs:subscribe", { workloadId });
    });

    socket.on("logs:chunk", (chunk) => {
      setContent((current) => {
        const next = `${current}${chunk}`;
        return next.length > 50000 ? next.slice(next.length - 50000) : next;
      });
    });

    socket.on("logs:error", (payload) => {
      setContent((current) => `${current}\n[error] ${payload.message}\n`);
    });

    return () => {
      socket.emit("logs:unsubscribe");
      socket.disconnect();
    };
  }, [token, workloadId]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>Live logs</h3>
          <p>Streaming directly from Docker logs over WebSocket.</p>
        </div>
      </div>
      <pre className="log-console">{content}</pre>
    </section>
  );
}
