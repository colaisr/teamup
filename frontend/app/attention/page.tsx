"use client";

import Link from "next/link";
import AiActionButton from "@/components/ai/AiActionButton";
import AiGeneratedBlock from "@/components/ai/AiGeneratedBlock";
import AnalyticsMappingBlockedCallout from "@/components/analytics/AnalyticsMappingBlockedCallout";
import { explainAttentionTask, type AttentionExplainResult } from "@/lib/ai";
import { api, explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedError } from "@/lib/mappingBlocked";
import { useActiveWorkspaceId } from "@/lib/workspace";
import { useCallback, useEffect, useMemo, useState } from "react";

type AttentionTask = {
  source_task_id: string;
  title: string;
  current_status: string | null;
  attention_score: number;
  severity?: "low" | "medium" | "high";
  loop_count?: number;
  signals?: Array<{
    code: string;
    severity: "low" | "medium" | "high";
    score: number;
    message: string;
    threshold_hours?: number;
    observed_hours?: number;
    threshold_count?: number;
    observed_count?: number;
  }>;
  reasons: string[];
  suggested_action: string;
};

export default function AttentionPage() {
  const [workspaceId] = useActiveWorkspaceId("");
  const [items, setItems] = useState<AttentionTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mappingBlocked, setMappingBlocked] = useState(false);
  const [aiBusyTaskId, setAiBusyTaskId] = useState("");
  const [aiByTask, setAiByTask] = useState<Record<string, AttentionExplainResult>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState<"all" | "critical" | "elevated">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"score" | "status" | "title">("score");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setBusy(true);
    setError("");
    setMappingBlocked(false);
    try {
      setItems(await api<AttentionTask[]>(`/api/analytics/attention/${workspaceId}`));
    } catch (err: unknown) {
      setMappingBlocked(isAnalyticsMappingBlockedError(err));
      setError(explainApiError(err));
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId.trim()) {
      setItems([]);
      setAiByTask({});
      setError("");
      setMappingBlocked(false);
      return;
    }
    void load();
  }, [workspaceId, load]);

  async function explainTask(sourceTaskId: string) {
    if (!workspaceId.trim()) return;
    setError("");
    setMappingBlocked(false);
    setAiBusyTaskId(sourceTaskId);
    try {
      const generated = await explainAttentionTask(workspaceId, sourceTaskId);
      setAiByTask((prev) => ({ ...prev, [sourceTaskId]: generated }));
    } catch (err: unknown) {
      setMappingBlocked(isAnalyticsMappingBlockedError(err));
      setError(explainApiError(err));
    } finally {
      setAiBusyTaskId("");
    }
  }

  const workspaceReady = workspaceId.trim() !== "";
  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.current_status).filter(Boolean) as string[])).sort(),
    [items]
  );
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = items.filter((item) => {
      if (q) {
        const text = [item.title, item.source_task_id, item.current_status, item.suggested_action, ...item.reasons]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (statusFilter !== "all" && (item.current_status || "") !== statusFilter) return false;
      if (scoreFilter === "critical" && item.attention_score < 0.75) return false;
      if (scoreFilter === "elevated" && (item.attention_score <= 0 || item.attention_score >= 0.75)) return false;
      if (severityFilter !== "all" && (item.severity || "low") !== severityFilter) return false;
      return true;
    });

    rows.sort((a, b) => {
      if (sortBy === "score") return b.attention_score - a.attention_score;
      if (sortBy === "status") return (a.current_status || "").localeCompare(b.current_status || "");
      return a.title.localeCompare(b.title);
    });
    return rows;
  }, [items, query, statusFilter, scoreFilter, severityFilter, sortBy]);

  const summary = useMemo(
    () => ({
      total: items.length,
      critical: items.filter((item) => item.attention_score >= 0.75).length,
      elevated: items.filter((item) => item.attention_score > 0 && item.attention_score < 0.75).length,
      withReasons: items.filter((item) => item.reasons.length > 0).length,
      shown: filteredItems.length
    }),
    [items, filteredItems]
  );

  function attentionTone(score: number): { bg: string; border: string; text: string } {
    if (score >= 0.75) return { bg: "var(--tone-danger-bg)", border: "var(--tone-danger-border)", text: "var(--tone-danger-text)" };
    if (score > 0) return { bg: "var(--tone-warning-bg)", border: "var(--tone-warning-border)", text: "var(--tone-warning-text)" };
    return { bg: "var(--tone-neutral-bg)", border: "var(--tone-neutral-border)", text: "var(--tone-neutral-text)" };
  }

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>{t("attention.title")}</h1>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <p className="muted" style={{ margin: 0, maxWidth: 820 }}>
            {t("attention.intro")}
          </p>
          <button className="btn btnGhost" disabled={!workspaceReady || busy} onClick={() => void load()}>
            {busy ? `${t("common.loading")}...` : t("attention.refresh")}
          </button>
        </div>
      </div>

      {!workspaceReady ? (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <strong>{t("attention.noWorkspaceTitle")}</strong>
          <p className="muted" style={{ margin: 0 }}>
            {t("attention.noWorkspaceBody")}
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
            { key: "attention.summary.total", value: summary.total },
            { key: "attention.summary.critical", value: summary.critical },
            { key: "attention.summary.elevated", value: summary.elevated },
            { key: "attention.summary.withReasons", value: summary.withReasons },
            { key: "attention.summary.shown", value: summary.shown }
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

      {workspaceReady ? (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("attention.searchPlaceholder")} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t("attention.filter.status.all")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value as "all" | "critical" | "elevated")}>
              <option value="all">{t("attention.filter.score.all")}</option>
              <option value="critical">{t("attention.filter.score.critical")}</option>
              <option value="elevated">{t("attention.filter.score.elevated")}</option>
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as "all" | "high" | "medium" | "low")}>
              <option value="all">{t("attention.filter.severity.all")}</option>
              <option value="high">{t("attention.filter.severity.high")}</option>
              <option value="medium">{t("attention.filter.severity.medium")}</option>
              <option value="low">{t("attention.filter.severity.low")}</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "score" | "status" | "title")}>
              <option value="score">{t("attention.sort.score")}</option>
              <option value="status">{t("attention.sort.status")}</option>
              <option value="title">{t("attention.sort.title")}</option>
            </select>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {t("attention.returnedPrefix")}: {filteredItems.length}
          </p>
        </div>
      ) : null}

      {workspaceReady && filteredItems.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {t("attention.noData")}
          </p>
        </div>
      ) : null}

      {filteredItems.map((item) => {
        const tone = attentionTone(item.attention_score);
        return (
          <div key={item.source_task_id} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <strong style={{ fontSize: 15 }}>{item.title}</strong>
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  ID: {item.source_task_id}
                </p>
              </div>
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
                {t("attention.label.score")}: {item.attention_score}
              </span>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{
                  borderRadius: 999,
                  border:
                    item.severity === "high"
                      ? "1px solid var(--tone-danger-border)"
                      : item.severity === "medium"
                        ? "1px solid var(--tone-warning-border)"
                        : "1px solid var(--tone-success-border)",
                  background:
                    item.severity === "high"
                      ? "var(--tone-danger-bg)"
                      : item.severity === "medium"
                        ? "var(--tone-warning-bg)"
                        : "var(--tone-success-bg)",
                  color:
                    item.severity === "high"
                      ? "var(--tone-danger-text)"
                      : item.severity === "medium"
                        ? "var(--tone-warning-text)"
                        : "var(--tone-success-text)",
                  fontSize: 12,
                  padding: "2px 8px",
                  fontWeight: 700
                }}
              >
                {t(`attention.severity.${item.severity || "low"}`)}
              </span>
              {typeof item.loop_count === "number" ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  {t("attention.loopCount")}: {item.loop_count}
                </span>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
              <div>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                  {t("attention.label.status")}
                </div>
                <span>{item.current_status || "—"}</span>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                  {t("attention.label.reasons")}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {item.reasons.length > 0 ? (
                    item.reasons.map((reason, idx) => (
                      <span
                        key={`${item.source_task_id}-reason-${idx}`}
                        style={{
                          borderRadius: 999,
                          border: "1px solid var(--tone-neutral-border)",
                          background: "var(--tone-neutral-bg)",
                          color: "var(--tone-neutral-text)",
                          fontSize: 12,
                          padding: "2px 8px"
                        }}
                      >
                        {reason}
                      </span>
                    ))
                  ) : (
                    <span className="muted">{t("attention.noReasons")}</span>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--panel-soft)",
                padding: "8px 10px"
              }}
            >
              <div className="muted" style={{ fontSize: 11, marginBottom: 2 }}>
                {t("attention.label.suggestion")}
              </div>
              <div style={{ fontSize: 14 }}>{item.suggested_action || "—"}</div>
            </div>

            {item.signals && item.signals.length > 0 ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div className="muted" style={{ fontSize: 11 }}>
                  {t("attention.signalsTitle")}
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {item.signals.slice(0, 3).map((signal, idx) => (
                    <div
                      key={`${item.source_task_id}-signal-${idx}`}
                      style={{
                        borderRadius: 8,
                        border:
                          signal.severity === "high"
                            ? "1px solid var(--tone-danger-border)"
                            : signal.severity === "medium"
                              ? "1px solid var(--tone-warning-border)"
                              : "1px solid var(--tone-neutral-border)",
                        background:
                          signal.severity === "high"
                            ? "var(--tone-danger-bg)"
                            : signal.severity === "medium"
                              ? "var(--tone-warning-bg)"
                              : "var(--tone-neutral-bg)",
                        color:
                          signal.severity === "high"
                            ? "var(--tone-danger-text)"
                            : signal.severity === "medium"
                              ? "var(--tone-warning-text)"
                              : "var(--tone-neutral-text)",
                        padding: "7px 10px",
                        fontSize: 12
                      }}
                    >
                      {signal.message}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <AiActionButton busy={aiBusyTaskId === item.source_task_id} onClick={() => void explainTask(item.source_task_id)}>
              {t("tasks.explainWithAi")}
            </AiActionButton>
            {aiByTask[item.source_task_id] ? (
              <AiGeneratedBlock
                summary={aiByTask[item.source_task_id].summary}
                takeaways={aiByTask[item.source_task_id].takeaways}
                recommendedActions={aiByTask[item.source_task_id].recommended_actions}
                limitations={aiByTask[item.source_task_id].limitations}
                evidenceRefs={aiByTask[item.source_task_id].evidence_refs}
              />
            ) : null}
          </div>
        );
      })}

      {mappingBlocked ? <AnalyticsMappingBlockedCallout /> : null}
      {error && !mappingBlocked ? <p style={{ color: "#ef4444" }}>{error}</p> : null}
    </div>
  );
}
