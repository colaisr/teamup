"use client";

import Link from "next/link";
import { useState } from "react";
import { api, explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedMessage } from "@/lib/mappingBlocked";
import { setActiveWorkspaceId, useActiveWorkspaceId } from "@/lib/workspace";

type Metrics = {
  median_lead_time_hours: number;
  median_cycle_time_hours: number;
  rework_rate: number;
  reopen_rate: number;
  task_count: number;
};

export default function DashboardPage() {
  const [workspaceId, setWorkspaceId] = useActiveWorkspaceId("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [mappingBlocked, setMappingBlocked] = useState(false);

  async function load() {
    if (!workspaceId) return;
    setError("");
    setMappingBlocked(false);
    try {
      const data = await api<Metrics>(`/api/analytics/metrics/${workspaceId}`);
      setMetrics(data);
    } catch (err: unknown) {
      const msg = explainApiError(err);
      setError(msg);
      setMappingBlocked(isAnalyticsMappingBlockedMessage(msg));
      setMetrics(null);
    }
  }

  return (
    <div className="grid">
      <h1>{t("dashboard.title")}</h1>
      <div className="card">
        <p className="muted">Workspace ID</p>
        <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
        <div style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => setActiveWorkspaceId(workspaceId)}>
            {t("common.save")}
          </button>
          <button className="btn" style={{ marginLeft: 8 }} onClick={load}>
            Обновить метрики
          </button>
        </div>
      </div>

      {metrics && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div className="card">Lead Time (ч): {metrics.median_lead_time_hours}</div>
          <div className="card">Cycle Time (ч): {metrics.median_cycle_time_hours}</div>
          <div className="card">Rework Rate: {metrics.rework_rate}</div>
          <div className="card">Reopen Rate: {metrics.reopen_rate}</div>
          <div className="card">Tasks: {metrics.task_count}</div>
        </div>
      )}
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

