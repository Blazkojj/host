import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext.jsx";
import LogConsole from "../components/LogConsole.jsx";

const statusClass = (status) => `status-badge status-${status}`;

const formatPorts = (bindings = []) =>
  bindings.length === 0 ? "No public ports" : bindings.map((item) => `${item.hostPort}:${item.containerPort}/${item.protocol}`).join(", ");

export default function BotsPage() {
  const { token } = useAuth();
  const [workloads, setWorkloads] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    token: "",
    startupCommand: "",
    envLines: "",
    memoryMb: "512",
    cpuLimit: "1",
    storageMb: "2048",
    autoRestart: true,
    archive: null
  });

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get("/workloads");
        const bots = response.data.workloads.filter((item) => item.kind === "bot");
        setWorkloads(bots);

        if (!selectedId && bots[0]) {
          setSelectedId(bots[0].id);
        }
      } catch (requestError) {
        setError(requestError.response?.data?.error || "Unable to load bots.");
      }
    };

    load();
    const intervalId = window.setInterval(load, 10000);
    return () => window.clearInterval(intervalId);
  }, [selectedId]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.archive) {
      setError("ZIP archive is required.");
      return;
    }

    setSubmitting(true);
    setNotice("");
    setError("");

    try {
      const payload = new FormData();
      payload.append("name", form.name);
      payload.append("token", form.token);
      payload.append("startupCommand", form.startupCommand);
      payload.append("envLines", form.envLines);
      payload.append("memoryMb", form.memoryMb);
      payload.append("cpuLimit", form.cpuLimit);
      payload.append("storageMb", form.storageMb);
      payload.append("autoRestart", String(form.autoRestart));
      payload.append("archive", form.archive);

      await api.post("/workloads/bots", payload, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setNotice("Bot container created and started.");
      setForm({
        name: "",
        token: "",
        startupCommand: "",
        envLines: "",
        memoryMb: "512",
        cpuLimit: "1",
        storageMb: "2048",
        autoRestart: true,
        archive: null
      });

      const response = await api.get("/workloads");
      const bots = response.data.workloads.filter((item) => item.kind === "bot");
      setWorkloads(bots);

      if (bots[0]) {
        setSelectedId(bots[0].id);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to create bot.");
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action, workloadId) => {
    setError("");
    setNotice("");

    try {
      if (action === "delete") {
        await api.delete(`/workloads/${workloadId}`);
        setNotice("Bot workload removed.");
      } else {
        await api.post(`/workloads/${workloadId}/${action}`);
        setNotice(`Bot ${action} command sent.`);
      }

      const response = await api.get("/workloads");
      const bots = response.data.workloads.filter((item) => item.kind === "bot");
      setWorkloads(bots);

      if (selectedId === workloadId && !bots.some((item) => item.id === workloadId)) {
        setSelectedId(bots[0]?.id || "");
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || `Unable to ${action} bot.`);
    }
  };

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <h1>Bots</h1>
          <p>Upload a ZIP, build a runtime-specific image dynamically and run the bot inside its own Docker container with enforced limits.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Create bot</h3>
            <p>Upload ZIP, wklej token i panel sam wykryje Node.js albo Python. Dla zwyklego Discord bota nie potrzebujesz publicznych portow.</p>
          </div>
        </div>

        <form className="page-grid" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>

            <label className="field">
              <span>Archive (.zip)</span>
              <input type="file" accept=".zip" onChange={(event) => setForm({ ...form, archive: event.target.files?.[0] || null })} required />
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Discord token</span>
              <input
                type="password"
                placeholder="Wklej token bota"
                value={form.token}
                onChange={(event) => setForm({ ...form, token: event.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Extra environment variables</span>
              <textarea
                placeholder={"CLIENT_ID=...\nGUILD_ID=..."}
                value={form.envLines}
                onChange={(event) => setForm({ ...form, envLines: event.target.value })}
              />
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Startup command override</span>
              <input
                placeholder="Opcjonalne, np. npm start albo python bot.py"
                value={form.startupCommand}
                onChange={(event) => setForm({ ...form, startupCommand: event.target.value })}
              />
            </label>

            <div className="page-grid">
              <div className="form-grid-three">
                <label className="field">
                  <span>RAM (MB)</span>
                  <input type="number" min="128" value={form.memoryMb} onChange={(event) => setForm({ ...form, memoryMb: event.target.value })} />
                </label>

                <label className="field">
                  <span>CPU</span>
                  <input type="number" step="0.25" min="0.25" value={form.cpuLimit} onChange={(event) => setForm({ ...form, cpuLimit: event.target.value })} />
                </label>

                <label className="field">
                  <span>Storage (MB)</span>
                  <input type="number" min="512" value={form.storageMb} onChange={(event) => setForm({ ...form, storageMb: event.target.value })} />
                </label>
              </div>

              <label className="field">
                <span>Auto restart</span>
                <select value={String(form.autoRestart)} onChange={(event) => setForm({ ...form, autoRestart: event.target.value === "true" })}>
                  <option value="true">unless-stopped</option>
                  <option value="false">disabled</option>
                </select>
              </label>
            </div>
          </div>

          <div className="button-row">
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? "Building image..." : "Create bot"}
            </button>
          </div>

          <div className="notice">
            Jezyk i domyslny plik startowy sa wykrywane automatycznie. Token nie powinien byc odczytywany z pliku w kodzie, tylko przekazywany jako zmienna srodowiskowa.
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Provisioned bots</h3>
            <p>Each bot runs inside a dedicated Docker container with its own filesystem and optional public port bindings.</p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Runtime</th>
              <th>Ports</th>
              <th>Limits</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workloads.map((workload) => (
              <tr key={workload.id}>
                <td className="stack">
                  <strong>{workload.name}</strong>
                  <span className="mono muted">{workload.container_name}</span>
                </td>
                <td>
                  <span className={statusClass(workload.status)}>{workload.status}</span>
                </td>
                <td>{workload.runtime}</td>
                <td className="mono">{formatPorts(workload.port_bindings)}</td>
                <td>{workload.memory_mb} MB / {Number(workload.cpu_limit).toFixed(2)} CPU / {workload.storage_mb} MB</td>
                <td>
                  <div className="inline-actions">
                    <button type="button" className="button button-ghost" onClick={() => setSelectedId(workload.id)}>
                      Logs
                    </button>
                    <button type="button" className="button button-success" onClick={() => runAction("start", workload.id)}>
                      Start
                    </button>
                    <button type="button" className="button button-ghost" onClick={() => runAction("stop", workload.id)}>
                      Stop
                    </button>
                    <button type="button" className="button button-ghost" onClick={() => runAction("restart", workload.id)}>
                      Restart
                    </button>
                    <button type="button" className="button button-danger" onClick={() => runAction("delete", workload.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {workloads.length === 0 ? (
              <tr>
                <td colSpan="6" className="muted">No bots created yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <LogConsole token={token} workloadId={selectedId} />
    </div>
  );
}
