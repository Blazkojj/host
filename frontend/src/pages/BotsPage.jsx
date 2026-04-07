import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext.jsx";
import LogConsole from "../components/LogConsole.jsx";

const statusClass = (status) => `status-badge status-${status}`;
const tokenKeyPattern = /(token|discord)/i;
const getTokenSourceLabel = (workload) => {
  const source = workload?.config_meta?.detectedTokenSource || workload?.config_meta?.detectedTokenSources?.[0];

  if (!source) {
    return "No token source found";
  }

  return `${source.file} -> ${source.key}`;
};

const formatPorts = (bindings = []) =>
  bindings.length === 0 ? "No public ports" : bindings.map((item) => `${item.hostPort}:${item.containerPort}/${item.protocol}`).join(", ");

const envMapToLines = (envMap = {}, { excludeTokenKeys = false } = {}) =>
  Object.entries(envMap)
    .filter(([key]) => !excludeTokenKeys || !tokenKeyPattern.test(key))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

export default function BotsPage() {
  const { token } = useAuth();
  const [workloads, setWorkloads] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    memoryMb: "512",
    cpuLimit: "1",
    storageMb: "2048",
    autoRestart: true,
    archive: null
  });
  const [editor, setEditor] = useState({
    name: "",
    token: "",
    startupCommand: "",
    envLines: "",
    memoryMb: "512",
    cpuLimit: "1",
    storageMb: "2048",
    autoRestart: true
  });

  const selectedWorkload = useMemo(() => workloads.find((item) => item.id === selectedId) || null, [workloads, selectedId]);

  const loadBots = async (preserveSelection = true) => {
    const response = await api.get("/workloads");
    const bots = response.data.workloads.filter((item) => item.kind === "bot");
    setWorkloads(bots);

    if (!preserveSelection || !bots.some((item) => item.id === selectedId)) {
      setSelectedId(bots[0]?.id || "");
    }

    return bots;
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadBots();
      } catch (requestError) {
        setError(requestError.response?.data?.error || "Unable to load bots.");
      }
    };

    load();
    const intervalId = window.setInterval(load, 10000);
    return () => window.clearInterval(intervalId);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedWorkload) {
      return;
    }

    setEditor({
      name: selectedWorkload.name,
      token: "",
      startupCommand: selectedWorkload.startup_command || "",
      envLines: envMapToLines(selectedWorkload.env || {}, { excludeTokenKeys: true }),
      memoryMb: String(selectedWorkload.memory_mb || 512),
      cpuLimit: String(selectedWorkload.cpu_limit || 1),
      storageMb: String(selectedWorkload.storage_mb || 2048),
      autoRestart: Boolean(selectedWorkload.auto_restart)
    });
  }, [selectedWorkload]);

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

      setNotice("Bot uploaded. Runtime, startup and token/config metadata were auto-detected where possible.");
      setForm({
        name: "",
        memoryMb: "512",
        cpuLimit: "1",
        storageMb: "2048",
        autoRestart: true,
        archive: null
      });

      const bots = await loadBots(false);
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

      await loadBots();
    } catch (requestError) {
      setError(requestError.response?.data?.error || `Unable to ${action} bot.`);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!selectedWorkload) {
      return;
    }

    setSaving(true);
    setNotice("");
    setError("");

    try {
      await api.patch(`/workloads/${selectedWorkload.id}`, {
        name: editor.name,
        token: editor.token,
        startupCommand: editor.startupCommand,
        envLines: editor.envLines,
        memoryMb: Number(editor.memoryMb),
        cpuLimit: Number(editor.cpuLimit),
        storageMb: Number(editor.storageMb),
        autoRestart: editor.autoRestart
      });

      setNotice("Bot settings updated and container recreated with new limits/config.");
      await loadBots();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to update bot.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <h1>Discord bots</h1>
          <p>Upload ZIP, choose a name and limits, then let the panel detect the runtime, startup file and known token/config patterns automatically.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Auto-detect flow</span>
          <h2>Upload first. Fine-tune later.</h2>
          <p>
            The bot wizard is now simpler: archive, name and resources. The panel scans the project to detect Node.js or Python, startup entrypoints and common Discord token key patterns.
          </p>
          <div className="hero-pills">
            <span className="hero-pill">Node.js auto-detect</span>
            <span className="hero-pill">Python auto-detect</span>
            <span className="hero-pill">Wrapper folder support</span>
            <span className="hero-pill">Edit after click</span>
          </div>
        </div>

        <div className="hero-card">
          <span className="eyebrow">How it works</span>
          <strong>ZIP -&gt; Detect -&gt; Run</strong>
          <p>If a bot still needs manual token or env tweaks, click it below and update settings without deleting the workload.</p>
          <div className="hero-endpoint mono">process.env.TOKEN / DISCORD_TOKEN / BOT_TOKEN</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Create bot</h3>
            <p>Public ports are not needed for a normal Discord bot. Just upload the archive, set the name and limits.</p>
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
              <span>RAM (MB)</span>
              <input type="number" min="128" value={form.memoryMb} onChange={(event) => setForm({ ...form, memoryMb: event.target.value })} />
            </label>

            <div className="form-grid-three">
              <label className="field">
                <span>CPU</span>
                <input type="number" step="0.25" min="0.25" value={form.cpuLimit} onChange={(event) => setForm({ ...form, cpuLimit: event.target.value })} />
              </label>

              <label className="field">
                <span>Storage (MB)</span>
                <input type="number" min="512" value={form.storageMb} onChange={(event) => setForm({ ...form, storageMb: event.target.value })} />
              </label>

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
              {submitting ? "Scanning archive..." : "Upload bot"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Provisioned bots</h3>
            <p>Click any bot to edit token, startup command, extra env variables and limits after it has been created.</p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Runtime</th>
              <th>Detection</th>
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
                <td className="stack">
                  <span>{workload.config_meta?.autoDetectedToken ? "Token auto-detected" : "Token source mapped"}</span>
                  <span className="mono muted">{getTokenSourceLabel(workload)}</span>
                </td>
                <td>{workload.memory_mb} MB / {Number(workload.cpu_limit).toFixed(2)} CPU / {workload.storage_mb} MB</td>
                <td>
                  <div className="inline-actions">
                    <button type="button" className="button" onClick={() => setSelectedId(workload.id)}>
                      Manage
                    </button>
                    <button type="button" className="button button-ghost" onClick={() => runAction("start", workload.id)}>
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

      {selectedWorkload ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Manage bot</h3>
              <p>Edit settings for <strong>{selectedWorkload.name}</strong> without deleting it. Saving recreates the container with the new config.</p>
            </div>
          </div>

          <div className="server-grid">
            <article className="server-card">
              <span className="eyebrow">Detected runtime</span>
              <h3>{selectedWorkload.runtime}</h3>
              <p>Auto startup: <span className="mono">{selectedWorkload.config_meta?.autoDetectedStartup || selectedWorkload.startup_command || "n/a"}</span></p>
              <p>Entry file: <span className="mono">{selectedWorkload.config_meta?.detectedEntryFile || "auto"}</span></p>
              <p>Project root: <span className="mono">{selectedWorkload.config_meta?.detectedProjectRoot || "."}</span></p>
              <div className="server-endpoint mono">{(selectedWorkload.config_meta?.detectedTokenKeys || []).join(", ") || "TOKEN"}</div>
              <p>These token-like keys were detected while scanning the archive.</p>
            </article>

            <article className="server-card">
              <span className="eyebrow">Detected token source</span>
              <h3>{selectedWorkload.upload_name || "Uploaded archive"}</h3>
              <div className="server-endpoint mono">{getTokenSourceLabel(selectedWorkload)}</div>
              <p>Ports: {formatPorts(selectedWorkload.port_bindings)}</p>
              <p>Need to adjust token or envs? Use the editor below and save. If the ZIP contained a real token value, the panel already mapped it into the container env.</p>
            </article>
          </div>

          <form className="page-grid" onSubmit={handleSave}>
            <div className="form-grid">
              <label className="field">
                <span>Name</span>
                <input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} required />
              </label>

              <label className="field">
                <span>Discord token</span>
                <input
                  type="password"
                  placeholder="Optional. Leave empty to keep current token."
                  value={editor.token}
                  onChange={(event) => setEditor({ ...editor, token: event.target.value })}
                />
              </label>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Startup command</span>
                <input
                  value={editor.startupCommand}
                  onChange={(event) => setEditor({ ...editor, startupCommand: event.target.value })}
                  placeholder="npm start / node bot.js / python main.py"
                />
              </label>

              <label className="field">
                <span>Extra environment variables</span>
                <textarea value={editor.envLines} onChange={(event) => setEditor({ ...editor, envLines: event.target.value })} />
              </label>
            </div>

            <div className="form-grid">
              <div className="form-grid-three">
                <label className="field">
                  <span>RAM (MB)</span>
                  <input type="number" min="128" value={editor.memoryMb} onChange={(event) => setEditor({ ...editor, memoryMb: event.target.value })} />
                </label>

                <label className="field">
                  <span>CPU</span>
                  <input type="number" step="0.25" min="0.25" value={editor.cpuLimit} onChange={(event) => setEditor({ ...editor, cpuLimit: event.target.value })} />
                </label>

                <label className="field">
                  <span>Storage (MB)</span>
                  <input type="number" min="512" value={editor.storageMb} onChange={(event) => setEditor({ ...editor, storageMb: event.target.value })} />
                </label>
              </div>

              <label className="field">
                <span>Auto restart</span>
                <select value={String(editor.autoRestart)} onChange={(event) => setEditor({ ...editor, autoRestart: event.target.value === "true" })}>
                  <option value="true">unless-stopped</option>
                  <option value="false">disabled</option>
                </select>
              </label>
            </div>

            <div className="button-row">
              <button type="submit" className="button" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button type="button" className="button button-ghost" onClick={() => setSelectedId(selectedWorkload.id)}>
                Refresh editor
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <LogConsole token={token} workloadId={selectedId} />
    </div>
  );
}
