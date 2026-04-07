import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext.jsx";
import LogConsole from "../components/LogConsole.jsx";
import { getEndpointAddress, getEndpointList, getPrimaryBinding } from "../utils/endpoints.js";

const statusClass = (status) => `status-badge status-${status}`;

const formatPorts = (bindings = []) =>
  bindings.length === 0 ? "No public ports" : bindings.map((item) => `${item.hostPort}:${item.containerPort}/${item.protocol}`).join(", ");

const envObjectToLines = (envObject = {}) => Object.entries(envObject).map(([key, value]) => `${key}=${value}`).join("\n");

export default function ServersPage() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [workloads, setWorkloads] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    templateKey: "",
    envLines: "",
    memoryMb: "2048",
    cpuLimit: "2",
    storageMb: "8192",
    autoRestart: true
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [templateResponse, workloadsResponse] = await Promise.all([api.get("/workloads/templates"), api.get("/workloads")]);
        const nextTemplates = templateResponse.data.templates;
        const servers = workloadsResponse.data.workloads.filter((item) => item.kind === "server");

        setTemplates(nextTemplates);
        setWorkloads(servers);

        if (!form.templateKey && nextTemplates[0]) {
          setForm((current) => ({
            ...current,
            templateKey: nextTemplates[0].id,
            envLines: envObjectToLines(nextTemplates[0].defaultEnv)
          }));
        }

        if (!selectedId && servers[0]) {
          setSelectedId(servers[0].id);
        }
      } catch (requestError) {
        setError(requestError.response?.data?.error || "Unable to load templates.");
      }
    };

    load();
    const intervalId = window.setInterval(load, 10000);
    return () => window.clearInterval(intervalId);
  }, [form.templateKey, selectedId]);

  const activeTemplate = templates.find((item) => item.id === form.templateKey);

  const copyToClipboard = async (value) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      setNotice(`Copied: ${value}`);
    } catch {
      setError("Unable to copy address.");
    }
  };

  const handleTemplateChange = (templateKey) => {
    const template = templates.find((item) => item.id === templateKey);
    setForm((current) => ({
      ...current,
      templateKey,
      envLines: template ? envObjectToLines(template.defaultEnv) : current.envLines
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice("");
    setError("");

    try {
      await api.post("/workloads/servers", {
        name: form.name,
        templateKey: form.templateKey,
        envLines: form.envLines,
        memoryMb: Number(form.memoryMb),
        cpuLimit: Number(form.cpuLimit),
        storageMb: Number(form.storageMb),
        autoRestart: form.autoRestart
      });

      setNotice("Game server container created and started.");
      setForm((current) => ({
        ...current,
        name: "",
        memoryMb: "2048",
        cpuLimit: "2",
        storageMb: "8192",
        autoRestart: true
      }));

      const response = await api.get("/workloads");
      const servers = response.data.workloads.filter((item) => item.kind === "server");
      setWorkloads(servers);
      if (servers[0]) {
        setSelectedId(servers[0].id);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to create game server.");
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
        setNotice("Game server removed.");
      } else {
        await api.post(`/workloads/${workloadId}/${action}`);
        setNotice(`Server ${action} command sent.`);
      }

      const response = await api.get("/workloads");
      const servers = response.data.workloads.filter((item) => item.kind === "server");
      setWorkloads(servers);

      if (selectedId === workloadId && !servers.some((item) => item.id === workloadId)) {
        setSelectedId(servers[0]?.id || "");
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || `Unable to ${action} server.`);
    }
  };

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <h1>Game servers</h1>
          <p>Provision real server containers from curated templates. Each one gets its own LAN join address you can copy straight from the panel.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="server-grid">
        {workloads.slice(0, 3).map((workload) => {
          const primaryBinding = getPrimaryBinding(workload.port_bindings || []);
          const endpoint = getEndpointAddress(primaryBinding);

          return (
            <article key={workload.id} className="server-card">
              <div className="server-card-top">
                <div>
                  <span className="eyebrow">{workload.template_key}</span>
                  <h3>{workload.name}</h3>
                </div>
                <span className={statusClass(workload.status)}>{workload.status}</span>
              </div>

              <div className="server-endpoint mono">{endpoint || "No public port yet"}</div>
              <p>{endpoint ? "Players on your network can join using this address." : "This server has no exposed join port yet."}</p>

              <div className="button-row">
                <button type="button" className="button" onClick={() => endpoint && copyToClipboard(endpoint)} disabled={!endpoint}>
                  Copy address
                </button>
                <button type="button" className="button button-ghost" onClick={() => setSelectedId(workload.id)}>
                  Open logs
                </button>
              </div>
            </article>
          );
        })}
        {workloads.length === 0 ? (
          <article className="server-card server-card-empty">
            <span className="eyebrow">No servers yet</span>
            <h3>Create your first private server</h3>
            <p>As soon as one is provisioned, its LAN join address will appear here.</p>
          </article>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Create server</h3>
            <p>The backend builds template images on demand, then provisions a container with Docker resource limits and auto-assigned public ports.</p>
          </div>
        </div>

        <form className="page-grid" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>

            <label className="field">
              <span>Template</span>
              <select value={form.templateKey} onChange={(event) => handleTemplateChange(event.target.value)} required>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeTemplate ? (
            <div className="notice">
              <strong>{activeTemplate.name}</strong>
              <div className="muted">{activeTemplate.description}</div>
              <div className="mono">Ports: {activeTemplate.ports.map((item) => `${item.containerPort}/${item.protocol}`).join(", ")}</div>
            </div>
          ) : null}

          <div className="form-grid">
            <label className="field">
              <span>Environment variables</span>
              <textarea value={form.envLines} onChange={(event) => setForm({ ...form, envLines: event.target.value })} />
            </label>

            <div className="page-grid">
              <div className="form-grid-three">
                <label className="field">
                  <span>RAM (MB)</span>
                  <input type="number" min="512" value={form.memoryMb} onChange={(event) => setForm({ ...form, memoryMb: event.target.value })} />
                </label>

                <label className="field">
                  <span>CPU</span>
                  <input type="number" step="0.25" min="0.5" value={form.cpuLimit} onChange={(event) => setForm({ ...form, cpuLimit: event.target.value })} />
                </label>

                <label className="field">
                  <span>Storage (MB)</span>
                  <input type="number" min="1024" value={form.storageMb} onChange={(event) => setForm({ ...form, storageMb: event.target.value })} />
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
              {submitting ? "Provisioning..." : "Create server"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Provisioned servers</h3>
            <p>Every template runs in a dedicated container with public port bindings and persistent host-mounted data.</p>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Template</th>
              <th>Status</th>
              <th>Ports</th>
              <th>Join</th>
              <th>Limits</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workloads.map((workload) => {
              const primaryBinding = getPrimaryBinding(workload.port_bindings || []);
              const endpoint = getEndpointAddress(primaryBinding);
              const endpointList = getEndpointList(workload.port_bindings || []);

              return (
                <tr key={workload.id}>
                <td className="stack">
                  <strong>{workload.name}</strong>
                  <span className="mono muted">{workload.container_name}</span>
                </td>
                <td>{workload.template_key}</td>
                <td>
                  <span className={statusClass(workload.status)}>{workload.status}</span>
                </td>
                <td className="mono">{formatPorts(workload.port_bindings)}</td>
                <td className="stack">
                  <strong className="mono">{endpoint || "No join address"}</strong>
                  {endpointList.slice(1).map((item) => (
                    <span key={`${workload.id}-${item.hostPort}-${item.protocol}`} className="mono muted">
                      {item.address}
                    </span>
                  ))}
                </td>
                <td>{workload.memory_mb} MB / {Number(workload.cpu_limit).toFixed(2)} CPU / {workload.storage_mb} MB</td>
                <td>
                  <div className="inline-actions">
                    <button type="button" className="button" onClick={() => endpoint && copyToClipboard(endpoint)} disabled={!endpoint}>
                      Copy IP
                    </button>
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
              );
            })}
            {workloads.length === 0 ? (
              <tr>
                <td colSpan="7" className="muted">No game servers created yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <LogConsole token={token} workloadId={selectedId} />
    </div>
  );
}
