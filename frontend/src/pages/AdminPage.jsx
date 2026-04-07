import { useEffect, useState } from "react";
import { api } from "../api/client";

const statusClass = (status) => `status-badge status-${status}`;

const formatPorts = (bindings = []) =>
  bindings.length === 0 ? "No public ports" : bindings.map((item) => `${item.hostPort}:${item.containerPort}/${item.protocol}`).join(", ");

const formatBytes = (value = 0) => {
  if (!value) {
    return "0 MB";
  }

  return `${(value / 1024 / 1024).toFixed(0)} MB`;
};

export default function AdminPage() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [containers, setContainers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [overviewResponse, usersResponse, containersResponse] = await Promise.all([
          api.get("/admin/overview"),
          api.get("/admin/users"),
          api.get("/admin/containers")
        ]);

        setOverview(overviewResponse.data.overview);
        setUsers(usersResponse.data.users);
        setContainers(containersResponse.data.containers);
        setDrafts(
          Object.fromEntries(
            usersResponse.data.users.map((user) => [
              user.id,
              {
                role: user.role,
                can_hosting: user.can_hosting,
                max_bots: user.max_bots,
                max_servers: user.max_servers,
                max_ram_mb: user.max_ram_mb,
                max_cpu: user.max_cpu,
                max_storage_mb: user.max_storage_mb,
                blocked: user.blocked
              }
            ])
          )
        );
      } catch (requestError) {
        setError(requestError.response?.data?.error || "Unable to load admin data.");
      }
    };

    load();
    const intervalId = window.setInterval(async () => {
      try {
        const response = await api.get("/admin/containers");
        setContainers(response.data.containers);
      } catch {
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  const updateDraft = (userId, key, value) => {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [key]: value
      }
    }));
  };

  const saveUser = async (userId) => {
    setError("");
    setNotice("");

    try {
      const response = await api.patch(`/admin/users/${userId}`, drafts[userId]);
      setUsers((current) => current.map((item) => (item.id === userId ? response.data.user : item)));
      setNotice("User limits updated.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to update user.");
    }
  };

  const toggleUserField = async (userId, field) => {
    const currentUser = users.find((item) => item.id === userId);

    try {
      const response = await api.patch(`/admin/users/${userId}`, {
        [field]: !currentUser[field]
      });

      setUsers((current) => current.map((item) => (item.id === userId ? response.data.user : item)));
      setDrafts((current) => ({
        ...current,
        [userId]: {
          ...current[userId],
          [field]: response.data.user[field]
        }
      }));
      setNotice("User state updated.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to update user.");
    }
  };

  const killContainer = async (workloadId) => {
    setError("");
    setNotice("");

    try {
      await api.post(`/admin/containers/${workloadId}/kill`);
      setNotice("Container killed and workload removed.");
      const response = await api.get("/admin/containers");
      setContainers(response.data.containers);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to kill container.");
    }
  };

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <h1>Admin</h1>
          <p>Operate the control plane, edit quotas, block accounts and inspect real container usage from the Docker daemon.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="stats-grid">
        <article className="stat-card">
          <p>Total users</p>
          <strong>{overview?.total_users ?? "-"}</strong>
        </article>
        <article className="stat-card">
          <p>Total workloads</p>
          <strong>{overview?.total_workloads ?? "-"}</strong>
        </article>
        <article className="stat-card">
          <p>Running</p>
          <strong>{overview?.running ?? "-"}</strong>
        </article>
        <article className="stat-card">
          <p>Blocked users</p>
          <strong>{overview?.blocked_users ?? "-"}</strong>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>User management</h3>
            <p>Grant or reduce real provisioning capacity for each account.</p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Hosting</th>
              <th>Bots</th>
              <th>Servers</th>
              <th>RAM</th>
              <th>CPU</th>
              <th>Storage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="stack">
                  <strong>{user.email}</strong>
                  <span className="muted mono">{user.id}</span>
                </td>
                <td>
                  <select value={drafts[user.id]?.role || user.role} onChange={(event) => updateDraft(user.id, "role", event.target.value)}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="stack">
                  <span>{user.can_hosting ? "enabled" : "disabled"}</span>
                  <span>{user.blocked ? "blocked" : "active"}</span>
                </td>
                <td>
                  <input type="number" value={drafts[user.id]?.max_bots ?? user.max_bots} onChange={(event) => updateDraft(user.id, "max_bots", Number(event.target.value))} />
                </td>
                <td>
                  <input
                    type="number"
                    value={drafts[user.id]?.max_servers ?? user.max_servers}
                    onChange={(event) => updateDraft(user.id, "max_servers", Number(event.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={drafts[user.id]?.max_ram_mb ?? user.max_ram_mb}
                    onChange={(event) => updateDraft(user.id, "max_ram_mb", Number(event.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.25"
                    value={drafts[user.id]?.max_cpu ?? user.max_cpu}
                    onChange={(event) => updateDraft(user.id, "max_cpu", Number(event.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={drafts[user.id]?.max_storage_mb ?? user.max_storage_mb}
                    onChange={(event) => updateDraft(user.id, "max_storage_mb", Number(event.target.value))}
                  />
                </td>
                <td>
                  <div className="inline-actions">
                    <button type="button" className="button" onClick={() => saveUser(user.id)}>
                      Save
                    </button>
                    <button type="button" className="button button-ghost" onClick={() => toggleUserField(user.id, "can_hosting")}>
                      Toggle hosting
                    </button>
                    <button type="button" className="button button-danger" onClick={() => toggleUserField(user.id, "blocked")}>
                      Toggle block
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan="9" className="muted">No users found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Container monitoring</h3>
            <p>Snapshot of Docker metrics and current mapped ports.</p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Ports</th>
              <th>Limits</th>
              <th>Live usage</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((container) => (
              <tr key={container.id}>
                <td className="stack">
                  <strong>{container.name}</strong>
                  <span className="mono muted">{container.container_name}</span>
                </td>
                <td className="stack">
                  <span>{container.owner_email}</span>
                  <span>{container.kind}</span>
                </td>
                <td>
                  <span className={statusClass(container.status)}>{container.status}</span>
                </td>
                <td className="mono">{formatPorts(container.port_bindings)}</td>
                <td>{container.memory_mb} MB / {Number(container.cpu_limit).toFixed(2)} CPU / {container.storage_mb} MB</td>
                <td className="stack">
                  <span>RAM: {formatBytes(container.metrics?.memoryBytes)}</span>
                  <span>Limit: {formatBytes(container.metrics?.memoryLimitBytes)}</span>
                  <span>CPU: {container.metrics?.cpuPercent ?? 0}%</span>
                </td>
                <td>
                  <button type="button" className="button button-danger" onClick={() => killContainer(container.id)}>
                    Kill container
                  </button>
                </td>
              </tr>
            ))}
            {containers.length === 0 ? (
              <tr>
                <td colSpan="7" className="muted">No managed containers found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
