"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type ImpactRow = {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  delta_pct: number | null;
};

export default function ImpactPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setWorkspaceId(localStorage.getItem("teamup_workspace_id") || "");
  }, []);

  async function saveSnapshot(type: "baseline" | "current") {
    if (!workspaceId) return;
    await api(`/api/analytics/impact/snapshot/${workspaceId}?snapshot_type=${type}`, { method: "POST" });
  }

  async function load() {
    if (!workspaceId) return;
    setError("");
    try {
      const payload = await api<{ metrics: ImpactRow[] }>(`/api/analytics/impact/${workspaceId}`);
      setRows(payload.metrics);
    } catch (err: any) {
      setError(err.message || "Failed");
    }
  }

  return (
    <div className="grid">
      <h1>{t("impact.title")}</h1>
      <div className="card">
        <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder="workspace_id" />
        <button className="btn" style={{ marginLeft: 8 }} onClick={() => saveSnapshot("baseline")}>
          Сохранить baseline
        </button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={() => saveSnapshot("current")}>
          Сохранить current
        </button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={load}>
          Сравнить
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.metric} className="card">
          <strong>{row.metric}</strong>
          <p>Baseline: {row.baseline}</p>
          <p>Current: {row.current}</p>
          <p>Delta: {row.delta}</p>
          <p>Delta %: {row.delta_pct ?? "-"}</p>
        </div>
      ))}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}

