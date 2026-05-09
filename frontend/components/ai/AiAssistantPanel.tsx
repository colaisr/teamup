"use client";

import Link from "next/link";
import { useState } from "react";
import { useAiAssistant } from "@/components/ai/AiAssistantContext";
import AiGeneratedBlock from "@/components/ai/AiGeneratedBlock";
import { explainAttentionTask, type AttentionExplainResult } from "@/lib/ai";
import { explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedMessage } from "@/lib/mappingBlocked";

export default function AiAssistantPanel() {
  const { open, toggle, close, workspaceId, pagePath } = useAiAssistant();
  const [taskId, setTaskId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AttentionExplainResult | null>(null);

  const onExplain = async () => {
    if (!workspaceId.trim() || !taskId.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await explainAttentionTask(workspaceId, taskId);
      setResult(data);
    } catch (e: unknown) {
      const msg = explainApiError(e);
      setError(msg);
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
        AI Assistant
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
            border: "1px solid #334155",
            borderRadius: 12,
            background: "#0b1220",
            padding: 14,
            display: "grid",
            gap: 12
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Assistant</strong>
            <button type="button" className="btn" onClick={close}>
              Close
            </button>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Page: {pagePath || "-"} | Workspace: {workspaceId || "-"}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            MVP chat scaffold. First capability: explain one attention task by ID.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="source_task_id"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#111827",
                color: "#e5e7eb"
              }}
            />
            <button type="button" className="btn" disabled={busy} onClick={() => void onExplain()}>
              {busy ? "AI..." : "Explain task"}
            </button>
          </div>
          {error ? (
            <div style={{ display: "grid", gap: 6 }}>
              <p style={{ color: "#fca5a5", margin: 0 }}>{error}</p>
              {isAnalyticsMappingBlockedMessage(error) ? (
                <p className="muted" style={{ margin: 0 }}>
                  <Link href="/settings/integrations">{t("nav.settings.integrations")}</Link>
                </p>
              ) : null}
            </div>
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
