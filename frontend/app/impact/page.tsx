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

type ImpactResponse = {
  workspace_id: string;
  has_baseline: boolean;
  metrics: ImpactRow[];
};

const IMPACT_METRIC_LABELS: Record<string, string> = {
  median_lead_time_hours: "impact.metric.leadTime",
  median_cycle_time_hours: "impact.metric.cycleTime",
  rework_rate: "impact.metric.reworkRate",
  reopen_rate: "impact.metric.reopenRate",
  task_count: "impact.metric.taskCount",
};

function formatMetricValue(metric: string, value: number): string {
  if (metric.endsWith("_rate")) return `${(value * 100).toFixed(1)}%`;
  if (metric.endsWith("_hours")) return `${value.toFixed(1)} ${t("impact.unit.hours")}`;
  return String(Math.round(value));
}

export default function ImpactPage() {
  const [workspaceId, setWorkspaceId] = useActiveWorkspaceId("");
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [hasBaseline, setHasBaseline] = useState(false);
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
      const payload = await api<ImpactResponse>(`/api/analytics/impact/${workspaceId}`);
      setRows(payload.metrics);
      setHasBaseline(payload.has_baseline);
    } catch (err: unknown) {
      const msg = explainApiError(err);
      setError(msg);
      setMappingBlocked(isAnalyticsMappingBlockedMessage(msg));
      setRows([]);
      setHasBaseline(false);
    }
  }

  return (
    <div className="grid">
      <h1>{t("impact.title")}</h1>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <p className="muted" style={{ margin: 0 }}>
          {t("impact.intro")}
        </p>
        <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder={t("tasks.workspacePlaceholder")} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" style={{ marginLeft: 8 }} onClick={() => saveSnapshot("baseline")}>
          {t("impact.saveBaseline")}
        </button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={() => saveSnapshot("current")}>
          {t("impact.saveCurrent")}
        </button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={load}>
          {t("impact.compare")}
        </button>
        </div>
      </div>
      {!hasBaseline && rows.length > 0 ? (
        <p className="muted" style={{ color: "#fb923c" }}>
          {t("impact.noBaseline")}
        </p>
      ) : null}
      {rows.map((row) => (
        <div key={row.metric} className="card">
          <strong>{t(IMPACT_METRIC_LABELS[row.metric] || row.metric)}</strong>
          <p>{t("impact.baseline")}: {formatMetricValue(row.metric, row.baseline)}</p>
          <p>{t("impact.current")}: {formatMetricValue(row.metric, row.current)}</p>
          <p>{t("impact.delta")}: {formatMetricValue(row.metric, row.delta)}</p>
          <p>{t("impact.deltaPct")}: {row.delta_pct === null ? "—" : `${row.delta_pct}%`}</p>
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

