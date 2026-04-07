import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext.jsx";

const statusClass = (status) => `status-badge status-${status}`;

const renderPorts = (bindings = []) =>
  bindings.length === 0 ? "No public ports" : bindings.map((item) => `${item.hostPort}:${item.containerPort}/${item.protocol}`).join(", ");

export default function DashboardPage() {
  const { user } = useAuth();
  const [workloads, setWorkloads] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get("/workloads");
        setWorkloads(response.data.workloads);
      } catch (requestError) {
        setError(requestError.response?.data?.error || "Unable to load workloads.");
      }
    };

    load();
  }, []);

  const bots = workloads.filter((item) => item.kind === "bot");
  const servers = workloads.filter((item) => item.kind === "server");
  const running = workloads.filter((item) => item.status === "running");
  const ramAllocated = workloads.reduce((sum, item) => sum + Number(item.memory_mb || 0), 0);
  const cpuAllocated = workloads.reduce((sum, item) => sum + Number(item.cpu_limit || 0), 0);
  const storageAllocated = workloads.reduce((sum, item) => sum + Number(item.storage_mb || 0), 0);

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Provision real Docker workloads, watch live logs and keep user quotas inside enforced RAM, CPU and storage limits.</p>
        </div>
      </header>

      {error ? <div className="notice error">{error}</div> : null}

      <section className="stats-grid">
        <article className="stat-card">
          <p>Running workloads</p>
          <strong>{running.length}</strong>
        </article>
        <article className="stat-card">
          <p>Bots</p>
          <strong>{bots.length}</strong>
        </article>
        <article className="stat-card">
          <p>Game servers</p>
          <strong>{servers.length}</strong>
        </article>
        <article className="stat-card">
          <p>Allocated RAM</p>
          <strong>{ramAllocated} MB</strong>
        </article>
      </section>

      <section className="split-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Account quota</h3>
              <p>These limits are enforced during provisioning.</p>
            </div>
          </div>

          <div className="stack">
            <span>Bots: {bots.length} / {user?.max_bots}</span>
            <span>Servers: {servers.length} / {user?.max_servers}</span>
            <span>RAM: {ramAllocated} / {user?.max_ram_mb} MB</span>
            <span>CPU: {cpuAllocated.toFixed(2)} / {Number(user?.max_cpu || 0).toFixed(2)}</span>
            <span>Storage: {storageAllocated} / {user?.max_storage_mb} MB</span>
            <span>Hosting active: {user?.can_hosting ? "Yes" : "No"}</span>
            <span>Expires: {user?.hosting_expires_at ? new Date(user.hosting_expires_at).toLocaleString() : "No expiry"}</span>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Core stack</h3>
              <p>Built around an actual hosting workflow rather than mocked resource states.</p>
            </div>
          </div>

          <div className="stack">
            <span>Express API + PostgreSQL</span>
            <span>dockerode provisioning and lifecycle control</span>
            <span>WebSocket log streaming from Docker logs</span>
            <span>Per-container resource enforcement</span>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Recent workloads</h3>
            <p>Current public mappings and runtime status.</p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Ports</th>
              <th>Limits</th>
            </tr>
          </thead>
          <tbody>
            {workloads.map((workload) => (
              <tr key={workload.id}>
                <td className="stack">
                  <strong>{workload.name}</strong>
                  <span className="muted mono">{workload.container_name}</span>
                </td>
                <td>{workload.kind === "bot" ? workload.runtime : workload.template_key}</td>
                <td>
                  <span className={statusClass(workload.status)}>{workload.status}</span>
                </td>
                <td className="mono">{renderPorts(workload.port_bindings)}</td>
                <td>{workload.memory_mb} MB / {Number(workload.cpu_limit).toFixed(2)} CPU / {workload.storage_mb} MB</td>
              </tr>
            ))}
            {workloads.length === 0 ? (
              <tr>
                <td colSpan="5" className="muted">No workloads provisioned yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
