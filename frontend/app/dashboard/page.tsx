"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, explainApiError } from "@/lib/api";
import AnalyticsMappingBlockedCallout from "@/components/analytics/AnalyticsMappingBlockedCallout";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedError } from "@/lib/mappingBlocked";
import { useActiveWorkspaceId } from "@/lib/workspace";

type Metrics = {
  median_lead_time_hours: number;
  median_cycle_time_hours: number;
  rework_rate: number;
  reopen_rate: number;
  task_count: number;
};

export default function DashboardPage() {
  const [workspaceId] = useActiveWorkspaceId("");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mappingBlocked, setMappingBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setBusy(true);
    setError("");
    setMappingBlocked(false);
    try {
      const data = await api<Metrics>(`/api/analytics/metrics/${workspaceId}`);
      setMetrics(data);
    } catch (err: unknown) {
      setMappingBlocked(isAnalyticsMappingBlockedError(err));
      setError(explainApiError(err));
      setMetrics(null);
    } finally {
      setBusy(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId.trim()) {
      setMetrics(null);
      setError("");
      setMappingBlocked(false);
      return;
    }
    void load();
  }, [workspaceId, load]);

  function formatHours(value: number): string {
    return `${value.toFixed(1)} ${t("dashboard.unit.hours")}`;
  }

  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  function flowRiskLead(value: number): "low" | "medium" | "high" {
    if (value >= 120) return "high";
    if (value >= 72) return "medium";
    return "low";
  }

  function qualityRisk(value: number): "low" | "medium" | "high" {
    if (value >= 0.2) return "high";
    if (value >= 0.1) return "medium";
    return "low";
  }

  function toneByRisk(risk: "low" | "medium" | "high"): { bg: string; border: string; text: string } {
    if (risk === "high") return { bg: "var(--tone-danger-bg)", border: "var(--tone-danger-border)", text: "var(--tone-danger-text)" };
    if (risk === "medium") return { bg: "var(--tone-warning-bg)", border: "var(--tone-warning-border)", text: "var(--tone-warning-text)" };
    return { bg: "var(--tone-success-bg)", border: "var(--tone-success-border)", text: "var(--tone-success-text)" };
  }

  const workspaceReady = workspaceId.trim() !== "";
  const leadRisk = metrics ? flowRiskLead(metrics.median_lead_time_hours) : "low";
  const cycleRisk = metrics ? flowRiskLead(metrics.median_cycle_time_hours) : "low";
  const reworkRisk = metrics ? qualityRisk(metrics.rework_rate) : "low";
  const reopenRisk = metrics ? qualityRisk(metrics.reopen_rate) : "low";
  const changedSignals = useMemo(() => {
    if (!metrics) return [];
    const signals: string[] = [];
    if (leadRisk !== "low") signals.push(t("dashboard.signal.leadRisk"));
    if (cycleRisk !== "low") signals.push(t("dashboard.signal.cycleRisk"));
    if (reworkRisk !== "low") signals.push(t("dashboard.signal.reworkRisk"));
    if (reopenRisk !== "low") signals.push(t("dashboard.signal.reopenRisk"));
    return signals;
  }, [metrics, leadRisk, cycleRisk, reworkRisk, reopenRisk]);

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>{t("dashboard.title")}</h1>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
          <p className="muted" style={{ margin: 0, maxWidth: 820 }}>
            {t("dashboard.intro")}
          </p>
          <button className="btn btnGhost" disabled={!workspaceReady || busy} onClick={() => void load()}>
            {busy ? `${t("common.loading")}...` : t("dashboard.refreshMetrics")}
          </button>
        </div>
      </div>

      {!workspaceReady ? (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <strong>{t("dashboard.noWorkspaceTitle")}</strong>
          <p className="muted" style={{ margin: 0 }}>
            {t("dashboard.noWorkspaceBody")}
          </p>
          <div>
            <Link href="/settings/user?tab=workspaces" className="btn">
              {t("tasks.openWorkspaceSettings")}
            </Link>
          </div>
        </div>
      ) : null}

      {metrics ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            <div className="card" style={{ padding: 12, display: "grid", gap: 4, background: "var(--panel-soft)", border: "1px solid var(--border)" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {t("dashboard.metric.leadTime")}
              </span>
              <strong style={{ fontSize: 22 }}>{formatHours(metrics.median_lead_time_hours)}</strong>
            </div>
            <div className="card" style={{ padding: 12, display: "grid", gap: 4, background: "var(--panel-soft)", border: "1px solid var(--border)" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {t("dashboard.metric.cycleTime")}
              </span>
              <strong style={{ fontSize: 22 }}>{formatHours(metrics.median_cycle_time_hours)}</strong>
            </div>
            <div className="card" style={{ padding: 12, display: "grid", gap: 4, background: "var(--panel-soft)", border: "1px solid var(--border)" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {t("dashboard.metric.reworkRate")}
              </span>
              <strong style={{ fontSize: 22 }}>{formatPercent(metrics.rework_rate)}</strong>
            </div>
            <div className="card" style={{ padding: 12, display: "grid", gap: 4, background: "var(--panel-soft)", border: "1px solid var(--border)" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {t("dashboard.metric.reopenRate")}
              </span>
              <strong style={{ fontSize: 22 }}>{formatPercent(metrics.reopen_rate)}</strong>
            </div>
            <div className="card" style={{ padding: 12, display: "grid", gap: 4, background: "var(--panel-soft)", border: "1px solid var(--border)" }}>
              <span className="muted" style={{ fontSize: 12 }}>
                {t("dashboard.metric.tasks")}
              </span>
              <strong style={{ fontSize: 22 }}>{metrics.task_count}</strong>
            </div>
          </div>

          <div className="card" style={{ display: "grid", gap: 12 }}>
            <strong>{t("dashboard.riskTitle")}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {[
                { key: "dashboard.risk.leadTime", risk: leadRisk },
                { key: "dashboard.risk.cycleTime", risk: cycleRisk },
                { key: "dashboard.risk.rework", risk: reworkRisk },
                { key: "dashboard.risk.reopen", risk: reopenRisk }
              ].map((item) => {
                const tone = toneByRisk(item.risk);
                return (
                  <div
                    key={item.key}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${tone.border}`,
                      background: tone.bg,
                      color: tone.text,
                      padding: "10px 12px",
                      display: "grid",
                      gap: 5
                    }}
                  >
                    <strong>{t(item.key)}</strong>
                    <span style={{ fontSize: 13 }}>{t(`dashboard.risk.${item.risk}`)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel-soft)", padding: "10px 12px" }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                {t("dashboard.signalTitle")}
              </div>
              <div style={{ fontSize: 14 }}>
                {changedSignals.length > 0 ? changedSignals.join(" · ") : t("dashboard.signalNone")}
              </div>
            </div>
          </div>

          <div className="card" style={{ display: "grid", gap: 8 }}>
            <strong>{t("dashboard.nextActionsTitle")}</strong>
            <p className="muted" style={{ margin: 0 }}>{t("dashboard.nextActionsHint")}</p>
            <div style={{ display: "grid", gap: 6 }}>
              {[
                t("dashboard.nextAction.1"),
                t("dashboard.nextAction.2"),
                t("dashboard.nextAction.3")
              ].map((line) => (
                <div key={line} style={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel-soft)", padding: "8px 10px" }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {mappingBlocked ? <AnalyticsMappingBlockedCallout /> : null}
      {error && !mappingBlocked ? <p style={{ color: "#ef4444" }}>{error}</p> : null}
    </div>
  );
}
