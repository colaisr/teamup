"use client";

import Link from "next/link";
import { useState } from "react";
import { api, explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedMessage } from "@/lib/mappingBlocked";
import { useActiveWorkspaceId } from "@/lib/workspace";

type ImpactRow = {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  delta_pct: number | null;
};

export default function ImpactPage() {
  const [workspaceId, setWorkspaceId] = useActiveWorkspaceId("");
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [error, setError] = useState("");
  const [mappingBlocked, setMappingBlocked] = useState(false);

  async function saveSnapshot(type: "baseline" | "current") {
    if (!workspaceId) return;
    setError("");
    setMappingBlocked(false);
    try {
      await api(`/api/analytics/impact/snapshot/${workspaceId}?snapshot_type=${type}`, { method: "POST" });
    } catch (err: unknown) {
      const msg = explainApiError(err);
      setError(msg);
      setMappingBlocked(isAnalyticsMappingBlockedMessage(msg));
    }
  }

  async function load() {
    if (!workspaceId) return;
    setError("");
    setMappingBlocked(false);
    try {
      const payload = await api<{ metrics: ImpactRow[] }>(`/api/analytics/impact/${workspaceId}`);
      setRows(payload.metrics);
    } catch (err: unknown) {
      const msg = explainApiError(err);
      setError(msg);
      setMappingBlocked(isAnalyticsMappingBlockedMessage(msg));
      setRows([]);
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
      {error && (
        <div>
          <p style={{ color: "#f87171" }}>{error}</p>
          {mappingBlocked ? (
            <p className="muted" style={{ marginTop: 8 }}>
              <Link href="/settings/integrations">{t("nav.settings.integrations")}</Link>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

