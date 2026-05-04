"use client";

import { useEffect } from "react";
import { useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type MappingRow = {
  source_status: string;
  normalized_status: string;
};

const options = ["Not Started", "Ready", "In Progress", "Review", "QA", "Blocked", "Done", "Cancelled"];

export default function MappingPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [scopeId, setScopeId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setWorkspaceId(localStorage.getItem("teamup_workspace_id") || "");
  }, []);

  async function loadStatuses() {
    const res = await api<{ statuses: string[]; scope_id: string }>(`/api/integrations/clickup/statuses/${workspaceId}`);
    setScopeId(res.scope_id);
    setRows(res.statuses.map((s) => ({ source_status: s, normalized_status: "In Progress" })));
  }

  async function saveMappings() {
    const res = await api<{ message: string }>("/api/integrations/workflow-mapping", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        scope_type: "list",
        scope_id: scopeId,
        mappings: rows
      })
    });
    setMessage(res.message);
  }

  return (
    <div className="grid">
      <h1>{t("onboarding.mapping.title")}</h1>
      <div className="card">
        <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder="workspace_id" />
        <button className="btn" style={{ marginLeft: 8 }} onClick={loadStatuses}>
          Загрузить статусы
        </button>
      </div>
      {rows.map((row, idx) => (
        <div className="card" key={`${row.source_status}-${idx}`} style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>{row.source_status}</div>
          <select
            value={row.normalized_status}
            onChange={(e) =>
              setRows((prev) =>
                prev.map((item, i) => (i === idx ? { ...item, normalized_status: e.target.value } : item))
              )
            }
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      ))}
      {rows.length > 0 && (
        <button className="btn" onClick={saveMappings}>
          {t("common.save")}
        </button>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

