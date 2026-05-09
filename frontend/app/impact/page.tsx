"use client";

import { useState } from "react";
import { ImpactTrendCharts, type ImpactHistorySnapshot } from "@/components/impact/ImpactTrendCharts";
import AnalyticsMappingBlockedCallout from "@/components/analytics/AnalyticsMappingBlockedCallout";
import { api, explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedError } from "@/lib/mappingBlocked";
import { useActiveWorkspaceId } from "@/lib/workspace";

type ImpactRow = {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  delta_pct: number | null;
  direction: "improved" | "worsened" | "neutral";
};

type ImpactResponse = {
  workspace_id: string;
  has_baseline: boolean;
  metrics: ImpactRow[];
  commentary: {
    improved: string[];
    worsened: string[];
  };
};

type ImpactHistoryResponse = {
  workspace_id: string;
  snapshots: ImpactHistorySnapshot[];
};

const HISTORY_METRIC_ORDER = [
  "median_lead_time_hours",
  "median_cycle_time_hours",
  "rework_rate",
  "reopen_rate",
  "task_count",
] as const;

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

function metricLabel(metric: string): string {
  return t(IMPACT_METRIC_LABELS[metric] || metric);
}

function directionColor(direction: ImpactRow["direction"]): string {
  if (direction === "improved") return "#4ade80";
  if (direction === "worsened") return "#fb7185";
  return "#94a3b8";
}

export default function ImpactPage() {
  const [workspaceId, setWorkspaceId] = useActiveWorkspaceId("");
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [commentary, setCommentary] = useState<ImpactResponse["commentary"]>({ improved: [], worsened: [] });
  const [historyRows, setHistoryRows] = useState<ImpactHistorySnapshot[]>([]);
  const [historySynced, setHistorySynced] = useState(false);
  const [error, setError] = useState("");
  const [mappingBlocked, setMappingBlocked] = useState(false);

  async function load() {
    if (!workspaceId) return;
    setError("");
    setMappingBlocked(false);
    try {
      const [payload, hist] = await Promise.all([
        api<ImpactResponse>(`/api/analytics/impact/${workspaceId}`),
        api<ImpactHistoryResponse>(`/api/analytics/impact/history/${workspaceId}`),
      ]);
      setRows(payload.metrics);
      setHasBaseline(payload.has_baseline);
      setCommentary(payload.commentary);
      setHistoryRows(hist.snapshots);
      setHistorySynced(true);
    } catch (err: unknown) {
      setError(explainApiError(err));
      setMappingBlocked(isAnalyticsMappingBlockedError(err));
      setRows([]);
      setHasBaseline(false);
      setCommentary({ improved: [], worsened: [] });
      setHistoryRows([]);
      setHistorySynced(false);
    }
  }

  async function saveSnapshot(type: "baseline" | "current") {
    if (!workspaceId) return;
    setError("");
    setMappingBlocked(false);
    try {
      await api(`/api/analytics/impact/snapshot/${workspaceId}?snapshot_type=${type}`, { method: "POST" });
      await load();
    } catch (err: unknown) {
      setError(explainApiError(err));
      setMappingBlocked(isAnalyticsMappingBlockedError(err));
    }
  }

  function snapshotTypeLabel(type: string): string {
    if (type === "baseline") return t("impact.snapshotType.baseline");
    if (type === "current") return t("impact.snapshotType.current");
    if (type === "weekly") return t("impact.snapshotType.weekly");
    return type;
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
      {hasBaseline && rows.length > 0 ? (
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <strong>{t("impact.commentaryTitle")}</strong>
          <p className="muted" style={{ margin: 0 }}>
            {commentary.improved.length > 0
              ? `${t("impact.improved")}: ${commentary.improved.map(metricLabel).join(", ")}`
              : t("impact.noImproved")}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {commentary.worsened.length > 0
              ? `${t("impact.worsened")}: ${commentary.worsened.map(metricLabel).join(", ")}`
              : t("impact.noWorsened")}
          </p>
        </div>
      ) : null}
      {workspaceId && historySynced && historyRows.length > 0 ? (
        <ImpactTrendCharts
          snapshots={historyRows}
          metricKeys={HISTORY_METRIC_ORDER}
          metricLabel={metricLabel}
          formatValue={formatMetricValue}
        />
      ) : null}
      {rows.map((row) => (
        <div key={row.metric} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <strong>{metricLabel(row.metric)}</strong>
            <span style={{ color: directionColor(row.direction), fontWeight: 700 }}>
              {t(`impact.direction.${row.direction}`)}
            </span>
          </div>
          <p>{t("impact.baseline")}: {formatMetricValue(row.metric, row.baseline)}</p>
          <p>{t("impact.current")}: {formatMetricValue(row.metric, row.current)}</p>
          <p>{t("impact.delta")}: {formatMetricValue(row.metric, row.delta)}</p>
          <p>{t("impact.deltaPct")}: {row.delta_pct === null ? "—" : `${row.delta_pct}%`}</p>
        </div>
      ))}
      {workspaceId && historySynced ? (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <strong>{t("impact.historyTitle")}</strong>
          {historyRows.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {t("impact.historyEmpty")}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(148,163,184,0.35)" }}>
                    <th style={{ padding: "6px 8px" }}>{t("impact.snapshotAt")}</th>
                    <th style={{ padding: "6px 8px" }}>{t("impact.snapshotTypeLabel")}</th>
                    {HISTORY_METRIC_ORDER.map((m) => (
                      <th key={m} style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                        {metricLabel(m)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((snap, idx) => (
                    <tr key={`${snap.created_at ?? ""}-${snap.snapshot_type}-${idx}`} style={{ borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
                      <td style={{ padding: "6px 8px" }}>
                        {snap.created_at ? new Date(snap.created_at).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: "6px 8px" }}>{snapshotTypeLabel(snap.snapshot_type)}</td>
                      {HISTORY_METRIC_ORDER.map((m) => (
                        <td key={m} style={{ padding: "6px 8px" }}>
                          {formatMetricValue(m, snap.metrics[m] ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
      {mappingBlocked ? <AnalyticsMappingBlockedCallout /> : null}
      {error && !mappingBlocked ? <p style={{ color: "#f87171" }}>{error}</p> : null}
    </div>
  );
}

