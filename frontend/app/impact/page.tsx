"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  if (direction === "improved") return "var(--tone-success-text)";
  if (direction === "worsened") return "var(--tone-danger-text)";
  return "var(--tone-neutral-text)";
}

function directionTone(direction: ImpactRow["direction"]): { bg: string; border: string; text: string } {
  if (direction === "improved") {
    return { bg: "var(--tone-success-bg)", border: "var(--tone-success-border)", text: "var(--tone-success-text)" };
  }
  if (direction === "worsened") {
    return { bg: "var(--tone-danger-bg)", border: "var(--tone-danger-border)", text: "var(--tone-danger-text)" };
  }
  return { bg: "var(--tone-neutral-bg)", border: "var(--tone-neutral-border)", text: "var(--tone-neutral-text)" };
}

export default function ImpactPage() {
  const [workspaceId] = useActiveWorkspaceId("");
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [commentary, setCommentary] = useState<ImpactResponse["commentary"]>({ improved: [], worsened: [] });
  const [historyRows, setHistoryRows] = useState<ImpactHistorySnapshot[]>([]);
  const [historySynced, setHistorySynced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapshotAction, setSnapshotAction] = useState<"baseline" | "current" | null>(null);
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState("");
  const [mappingBlocked, setMappingBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId.trim()) {
      setRows([]);
      setHasBaseline(false);
      setCommentary({ improved: [], worsened: [] });
      setHistoryRows([]);
      setHistorySynced(false);
      setError("");
      setMappingBlocked(false);
      return;
    }
    void load();
  }, [workspaceId, load]);

  async function saveSnapshot(type: "baseline" | "current") {
    if (!workspaceId) return;
    setSnapshotAction(type);
    setError("");
    setMappingBlocked(false);
    try {
      await api(`/api/analytics/impact/snapshot/${workspaceId}?snapshot_type=${type}`, { method: "POST" });
      await load();
    } catch (err: unknown) {
      setError(explainApiError(err));
      setMappingBlocked(isAnalyticsMappingBlockedError(err));
    } finally {
      setSnapshotAction(null);
    }
  }

  function snapshotTypeLabel(type: string): string {
    if (type === "baseline") return t("impact.snapshotType.baseline");
    if (type === "current") return t("impact.snapshotType.current");
    if (type === "weekly") return t("impact.snapshotType.weekly");
    return type;
  }

  function narrativeLine(): string {
    const i = commentary.improved.length;
    const w = commentary.worsened.length;
    if (i === 0 && w === 0) return t("impact.narrativeSteady");
    return t("impact.narrativeMixed").replace("{i}", String(i)).replace("{w}", String(w));
  }

  const workspaceReady = workspaceId.trim() !== "";
  const visibleRows = useMemo(
    () => (showOnlyChanged ? rows.filter((row) => row.direction !== "neutral") : rows),
    [rows, showOnlyChanged]
  );
  const improvedCount = rows.filter((row) => row.direction === "improved").length;
  const worsenedCount = rows.filter((row) => row.direction === "worsened").length;
  const neutralCount = rows.filter((row) => row.direction === "neutral").length;

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>{t("impact.title")}</h1>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
          <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
            {t("impact.intro")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btnGhost" disabled={!workspaceReady || busy || snapshotAction !== null} onClick={() => void load()}>
              {busy ? `${t("common.loading")}...` : t("impact.refresh")}
            </button>
            <button
              className="btn"
              disabled={!workspaceReady || busy || snapshotAction !== null}
              aria-busy={snapshotAction === "baseline"}
              onClick={() => void saveSnapshot("baseline")}
            >
              {snapshotAction === "baseline" ? <span className="btnSpinner" aria-hidden /> : null}
              {t("impact.saveBaseline")}
            </button>
            <button
              className="btn"
              disabled={!workspaceReady || busy || snapshotAction !== null}
              aria-busy={snapshotAction === "current"}
              onClick={() => void saveSnapshot("current")}
            >
              {snapshotAction === "current" ? <span className="btnSpinner" aria-hidden /> : null}
              {t("impact.saveCurrent")}
            </button>
          </div>
        </div>
      </div>

      {!workspaceReady ? (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <strong>{t("impact.noWorkspaceTitle")}</strong>
          <p className="muted" style={{ margin: 0 }}>
            {t("impact.noWorkspaceBody")}
          </p>
          <div>
            <Link href="/settings/user?tab=workspaces" className="btn">
              {t("tasks.openWorkspaceSettings")}
            </Link>
          </div>
        </div>
      ) : null}

      {workspaceReady ? (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10
          }}
        >
          {[
            { key: "impact.summary.metrics", value: rows.length },
            { key: "impact.summary.improved", value: improvedCount },
            { key: "impact.summary.worsened", value: worsenedCount },
            { key: "impact.summary.neutral", value: neutralCount },
            { key: "impact.summary.snapshots", value: historyRows.length }
          ].map((item) => (
            <div
              key={item.key}
              className="card"
              style={{ padding: 12, display: "grid", gap: 4, background: "var(--panel-soft)", border: "1px solid var(--border)" }}
            >
              <span className="muted" style={{ fontSize: 12 }}>
                {t(item.key)}
              </span>
              <strong style={{ fontSize: 22 }}>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {!hasBaseline && rows.length > 0 ? (
        <div
          style={{
            borderRadius: 10,
            border: "1px solid var(--tone-warning-border)",
            background: "var(--tone-warning-bg)",
            color: "var(--tone-warning-text)",
            padding: "10px 12px",
            fontSize: 14
          }}
        >
          {t("impact.noBaseline")}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="card" style={{ display: "grid", gap: 16 }}>
          <div>
            <strong style={{ fontSize: "1.05rem" }}>{t("impact.pilotTitle")}</strong>
            <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
              {t("impact.pilotIntro")}
            </p>
            <p style={{ margin: "14px 0 6px", fontWeight: 700 }}>{t("impact.narrativeHeadline")}</p>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {narrativeLine()}
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ borderLeft: "3px solid var(--tone-success-border)", padding: "10px 12px", borderRadius: 8, background: "var(--tone-success-bg)" }}>
              <strong>{t("impact.improved")}</strong>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.92rem", lineHeight: 1.45 }}>
                {commentary.improved.length > 0
                  ? commentary.improved.map(metricLabel).join(", ")
                  : t("impact.noImproved")}
              </p>
            </div>
            <div style={{ borderLeft: "3px solid var(--tone-danger-border)", padding: "10px 12px", borderRadius: 8, background: "var(--tone-danger-bg)" }}>
              <strong>{t("impact.worsened")}</strong>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.92rem", lineHeight: 1.45 }}>
                {commentary.worsened.length > 0
                  ? commentary.worsened.map(metricLabel).join(", ")
                  : t("impact.noWorsened")}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="card" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <strong>{t("impact.compareTableTitle")}</strong>
            <button className="btn btnGhost" onClick={() => setShowOnlyChanged((prev) => !prev)}>
              {showOnlyChanged ? t("impact.showAll") : t("impact.showOnlyChanged")}
            </button>
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {visibleRows.map((row) => {
              const tone = directionTone(row.direction);
              return (
                <div key={row.metric} className="card" style={{ padding: 12, display: "grid", gap: 8, border: "1px solid var(--border)", background: "var(--panel-soft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ fontSize: 14 }}>{metricLabel(row.metric)}</strong>
                    <span
                      style={{
                        display: "inline-block",
                        borderRadius: 999,
                        border: `1px solid ${tone.border}`,
                        background: tone.bg,
                        color: tone.text,
                        padding: "3px 10px",
                        fontSize: 12,
                        fontWeight: 700
                      }}
                    >
                      {t(`impact.direction.${row.direction}`)}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t("impact.baseline")}: {formatMetricValue(row.metric, row.baseline)}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t("impact.current")}: {formatMetricValue(row.metric, row.current)}
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                    <span style={{ color: directionColor(row.direction), fontWeight: 700 }}>
                      {t("impact.delta")}: {formatMetricValue(row.metric, row.delta)}
                    </span>
                    <span className="muted">
                      {t("impact.deltaPct")}: {row.delta_pct === null ? "—" : `${row.delta_pct}%`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {visibleRows.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {t("impact.noChangedMetrics")}
            </p>
          ) : null}
        </div>
      ) : null}

      {workspaceId && historySynced ? (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{t("impact.trendsTitle")}</strong>
            <button className="btn btnGhost" type="button" onClick={() => setHistoryOpen((prev) => !prev)}>
              {historyOpen ? t("impact.hideHistoryAndTrends") : t("impact.showHistoryAndTrends")}
            </button>
          </div>
          {historyOpen ? (
            <>
              {historyRows.length > 0 ? (
                <ImpactTrendCharts
                  snapshots={historyRows}
                  metricKeys={HISTORY_METRIC_ORDER}
                  metricLabel={metricLabel}
                  formatValue={formatMetricValue}
                  showHeader={false}
                  asCard={false}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {workspaceId && historySynced && historyOpen ? (
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
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
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
                    <tr
                      key={`${snap.created_at ?? ""}-${snap.snapshot_type}-${idx}`}
                      style={{ borderBottom: "1px solid color-mix(in srgb, var(--border) 70%, transparent)" }}
                    >
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
      {error && !mappingBlocked ? <p style={{ color: "#ef4444" }}>{error}</p> : null}
    </div>
  );
}

