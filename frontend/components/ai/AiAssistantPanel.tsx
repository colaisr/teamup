"use client";

import Link from "next/link";
import { useState } from "react";
import { useAiAssistant } from "@/components/ai/AiAssistantContext";
import AiGeneratedBlock from "@/components/ai/AiGeneratedBlock";
import AnalyticsMappingBlockedCallout from "@/components/analytics/AnalyticsMappingBlockedCallout";
import { explainAttentionTask, type AttentionExplainResult } from "@/lib/ai";
import { explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedError } from "@/lib/mappingBlocked";

export default function AiAssistantPanel() {
  const { open, toggle, close, workspaceId, pagePath } = useAiAssistant();
  const [taskId, setTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mappingBlocked, setMappingBlocked] = useState(false);
  const [result, setResult] = useState<AttentionExplainResult | null>(null);

  const onExplain = async () => {
    if (!workspaceId.trim() || !taskId.trim()) return;
    setBusy(true);
    setError("");
    setMappingBlocked(false);
    try {
      const data = await explainAttentionTask(workspaceId, taskId);
      setResult(data);
    } catch (e: unknown) {
      setMappingBlocked(isAnalyticsMappingBlockedError(e));
      setError(explainApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={toggle}
        style={{ position: "fixed", right: 16, bottom: 16, zIndex: 10030 }}
      >
        {t("ai.fabOpen")}
      </button>

      {open ? (
        <aside
          style={{
            position: "fixed",
            right: 16,
            bottom: 70,
            width: "min(420px, calc(100vw - 32px))",
            maxHeight: "70vh",
            overflow: "auto",
            zIndex: 10031,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--panel-soft)",
            padding: 14,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{t("ai.panelTitle")}</strong>
            <button type="button" className="btn" onClick={close}>
              {t("common.close")}
            </button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {t("ai.pageLabel")}: {pagePath || "—"} · {t("ai.workspaceLabel")}: {workspaceId || "—"}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            {t("ai.scaffoldIntro")}
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder={t("ai.taskIdPlaceholder")}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                color: "var(--text)",
              }}
            />
            <button type="button" className="btn" disabled={busy} onClick={() => void onExplain()}>
              {busy ? t("ai.busyShort") : t("ai.explainTask")}
            </button>
          </div>
          {mappingBlocked ? <AnalyticsMappingBlockedCallout variant="inline" /> : null}
          {error && !mappingBlocked ? (
            <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p>
          ) : null}
          {result ? (
            <AiGeneratedBlock
              summary={result.summary}
              takeaways={result.takeaways}
              recommendedActions={result.recommended_actions}
              limitations={result.limitations}
              evidenceRefs={result.evidence_refs}
            />
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
