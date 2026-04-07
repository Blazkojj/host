import { useEffect, useMemo, useState } from "react";
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
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    templateKey: "",
    envLines: "",
    memoryMb: "2048",
    cpuLimit: "2",
    storageMb: "8192",
    autoRestart: true
  });
  const [editor, setEditor] = useState({
    name: "",
    envLines: "",
    memoryMb: "2048",
    cpuLimit: "2",
    storageMb: "8192",
    autoRestart: true
  });
  const [assetForm, setAssetForm] = useState({
    assetType: "plugins",
    asset: null
  });

  const selectedWorkload = useMemo(() => workloads.find((item) => item.id === selectedId) || null, [workloads, selectedId]);
  const activeTemplate = templates.find((item) => item.id === form.templateKey);
  const selectedTemplate = selectedWorkload ? templates.find((item) => item.id === selectedWorkload.template_key) : null;
  const selectedEndpoint = getEndpointAddress(getPrimaryBinding(selectedWorkload?.port_bindings || []));
  const selectedEndpointList = getEndpointList(selectedWorkload?.port_bindings || []);
  const uploadOptions = selectedTemplate?.capabilities?.uploads || [];

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

  const loadServers = async (preserveSelection = true) => {
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

    if (!preserveSelection || !servers.some((item) => item.id === selectedId)) {
      setSelectedId(servers[0]?.id || "");
    }

    return { nextTemplates, servers };
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadServers();
      } catch (requestError) {
        setError(requestError.response?.data?.error || "Unable to load templates.");
      }
    };

    load();
    const intervalId = window.setInterval(load, 10000);
    return () => window.clearInterval(intervalId);
  }, [form.templateKey, selectedId]);

  useEffect(() => {
    if (!selectedWorkload) {
      return;
    }

    setEditor({
      name: selectedWorkload.name,
      envLines: envObjectToLines(selectedWorkload.env || {}),
      memoryMb: String(selectedWorkload.memory_mb || 2048),
      cpuLimit: String(selectedWorkload.cpu_limit || 2),
      storageMb: String(selectedWorkload.storage_mb || 8192),
      autoRestart: Boolean(selectedWorkload.auto_restart)
    });
  }, [selectedWorkload]);

  useEffect(() => {
    if (!uploadOptions.length) {
      setAssetForm({ assetType: "plugins", asset: null });
      return;
    }

    setAssetForm((current) => ({
      ...current,
      assetType: uploadOptions.includes(current.assetType) ? current.assetType : uploadOptions[0],
      asset: null
    }));
  }, [selectedTemplate?.id]);

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

      const { servers } = await loadServers(false);
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

      await loadServers();
    } catch (requestError) {
      setError(requestError.response?.data?.error || `Unable to ${action} server.`);
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
        envLines: editor.envLines,
        memoryMb: Number(editor.memoryMb),
        cpuLimit: Number(editor.cpuLimit),
        storageMb: Number(editor.storageMb),
        autoRestart: editor.autoRestart
      });

      setNotice("Server settings updated and container recreated.");
      await loadServers();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to update server.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssetUpload = async (event) => {
    event.preventDefault();

    if (!selectedWorkload || !assetForm.asset) {
      setError("Choose a server asset first.");
      return;
    }

    setUploading(true);
    setNotice("");
    setError("");

    try {
      const payload = new FormData();
      payload.append("assetType", assetForm.assetType);
      payload.append("asset", assetForm.asset);

      const response = await api.post(`/workloads/${selectedWorkload.id}/assets`, payload, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setNotice(`Uploaded ${response.data.uploaded} to ${response.data.target || "/"}.`);
      setAssetForm((current) => ({
        ...current,
        asset: null
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Unable to upload Minecraft asset.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-grid">
      <header className="page-header">
        <div>
          <h1>Game servers</h1>
          <p>Provision real server containers from curated templates. Minecraft templates now expose a friendlier join flow plus plugin and mod uploads directly from the panel.</p>
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="server-grid">
        {templates
          .filter((template) => template.capabilities?.minecraft)
          .slice(0, 3)
          .map((template) => (
            <article key={template.id} className="server-card">
              <div className="server-card-top">
                <div>
                  <span className="eyebrow">Minecraft</span>
                  <h3>{template.name}</h3>
                </div>
              </div>

              <div className="server-endpoint mono">{template.capabilities?.plugins ? "Plugins ready" : template.capabilities?.mods ? "Mods ready" : "Vanilla setup"}</div>
              <p>{template.description}</p>
              <div className="hero-pills">
                {template.capabilities?.plugins ? <span className="hero-pill">Plugins</span> : null}
                {template.capabilities?.mods ? <span className="hero-pill">Mods</span> : null}
                <span className="hero-pill">Join IP after create</span>
              </div>
            </article>
          ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Create server</h3>
            <p>Paper is ideal for plugins. Fabric is ready for mod uploads. The panel will show the join IP right after provisioning.</p>
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
              {activeTemplate.capabilities?.minecraft ? (
                <div className="muted">
                  Minecraft uploads: {(activeTemplate.capabilities?.uploads || []).join(", ") || "none"}
                </div>
              ) : null}
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
            <p>Click a server to manage settings, copy its join address and upload Minecraft plugins or mods when supported.</p>
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
                      <button type="button" className="button" onClick={() => setSelectedId(workload.id)}>
                        Manage
                      </button>
                      <button type="button" className="button button-ghost" onClick={() => endpoint && copyToClipboard(endpoint)} disabled={!endpoint}>
                        Copy IP
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

      {selectedWorkload ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Manage server</h3>
              <p>Manage <strong>{selectedWorkload.name}</strong>, copy the join IP and upload Minecraft assets without touching SSH.</p>
            </div>
          </div>

          <div className="server-grid">
            <article className="server-card">
              <span className="eyebrow">Join address</span>
              <h3>{selectedWorkload.name}</h3>
              <div className="server-endpoint mono">{selectedEndpoint || "No public join port yet"}</div>
              <p>Use this address from any device in your local network. Additional ports are listed below if the template exposes more than one.</p>
              <div className="button-row">
                <button type="button" className="button" onClick={() => selectedEndpoint && copyToClipboard(selectedEndpoint)} disabled={!selectedEndpoint}>
                  Copy address
                </button>
              </div>
            </article>

            <article className="server-card">
              <span className="eyebrow">Minecraft uploads</span>
              <h3>{selectedTemplate?.name || selectedWorkload.template_key}</h3>
              <p>
                {selectedTemplate?.capabilities?.plugins
                  ? "This template supports plugin uploads."
                  : selectedTemplate?.capabilities?.mods
                    ? "This template supports mod uploads."
                    : "This template is focused on vanilla-style management."}
              </p>
              <div className="hero-pills">
                {(selectedTemplate?.capabilities?.uploads || []).map((upload) => (
                  <span key={upload} className="hero-pill">{upload}</span>
                ))}
              </div>
            </article>
          </div>

          <form className="page-grid" onSubmit={handleSave}>
            <div className="form-grid">
              <label className="field">
                <span>Name</span>
                <input value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} required />
              </label>

              <label className="field">
                <span>Environment variables</span>
                <textarea value={editor.envLines} onChange={(event) => setEditor({ ...editor, envLines: event.target.value })} />
              </label>
            </div>

            <div className="form-grid">
              <div className="form-grid-three">
                <label className="field">
                  <span>RAM (MB)</span>
                  <input type="number" min="512" value={editor.memoryMb} onChange={(event) => setEditor({ ...editor, memoryMb: event.target.value })} />
                </label>

                <label className="field">
                  <span>CPU</span>
                  <input type="number" step="0.25" min="0.5" value={editor.cpuLimit} onChange={(event) => setEditor({ ...editor, cpuLimit: event.target.value })} />
                </label>

                <label className="field">
                  <span>Storage (MB)</span>
                  <input type="number" min="1024" value={editor.storageMb} onChange={(event) => setEditor({ ...editor, storageMb: event.target.value })} />
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
                {saving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </form>

          {selectedTemplate?.capabilities?.minecraft ? (
            <form className="page-grid" onSubmit={handleAssetUpload}>
              <div className="panel-header">
                <div>
                  <h3>Minecraft assets</h3>
                  <p>Upload plugin jars, mod jars, worlds or config bundles directly into the correct data folders for this template.</p>
                </div>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Upload type</span>
                  <select value={assetForm.assetType} onChange={(event) => setAssetForm({ ...assetForm, assetType: event.target.value })}>
                    {uploadOptions.map((upload) => (
                      <option key={upload} value={upload}>
                        {upload}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>File (.jar / .zip / config)</span>
                  <input type="file" onChange={(event) => setAssetForm({ ...assetForm, asset: event.target.files?.[0] || null })} />
                </label>
              </div>

              <div className="button-row">
                <button type="submit" className="button" disabled={uploading || !assetForm.asset}>
                  {uploading ? "Uploading..." : "Upload asset"}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <LogConsole token={token} workloadId={selectedId} />
    </div>
  );
}
