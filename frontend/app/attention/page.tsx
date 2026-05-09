"use client";

import AiActionButton from "@/components/ai/AiActionButton";
import AiGeneratedBlock from "@/components/ai/AiGeneratedBlock";
import AnalyticsMappingBlockedCallout from "@/components/analytics/AnalyticsMappingBlockedCallout";
import { explainAttentionTask, type AttentionExplainResult } from "@/lib/ai";
import { api, explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedError } from "@/lib/mappingBlocked";
import { useActiveWorkspaceId } from "@/lib/workspace";
import { useState } from "react";

type AttentionTask = {
  source_task_id: string;
  title: string;
  current_status: string | null;
  attention_score: number;
  reasons: string[];
  suggested_action: string;
};

export default function AttentionPage() {
  const [workspaceId, setWorkspaceId] = useActiveWorkspaceId("");
  const [items, setItems] = useState<AttentionTask[]>([]);
  const [error, setError] = useState("");
  const [mappingBlocked, setMappingBlocked] = useState(false);
  const [aiBusyTaskId, setAiBusyTaskId] = useState("");
  const [aiByTask, setAiByTask] = useState<Record<string, AttentionExplainResult>>({});

  async function load() {
    if (!workspaceId) return;
    setError("");
    setMappingBlocked(false);
    try {
      setItems(await api<AttentionTask[]>(`/api/analytics/attention/${workspaceId}`));
    } catch (err: unknown) {
      setMappingBlocked(isAnalyticsMappingBlockedError(err));
      setError(explainApiError(err));
      setItems([]);
    }
  }

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

  return (
    <div className="grid">
      <h1>{t("attention.title")}</h1>
      <div className="card">
        <input
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          placeholder={t("tasks.workspacePlaceholder")}
        />
        <button className="btn" style={{ marginLeft: 8 }} onClick={load}>
          {t("tasks.load")}
        </button>
      </div>
      {items.map((item) => (
        <div key={item.source_task_id} className="card">
          <strong>{item.title}</strong>
          <p className="muted">ID: {item.source_task_id}</p>
          <p>
            {t("attention.label.status")}: {item.current_status || "—"}
          </p>
          <p>
            {t("attention.label.score")}: {item.attention_score}
          </p>
          <p>
            {t("attention.label.reasons")}: {item.reasons.join(", ")}
          </p>
          <p>
            {t("attention.label.suggestion")}: {item.suggested_action}
          </p>
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
      ))}
      {mappingBlocked ? <AnalyticsMappingBlockedCallout /> : null}
      {error && !mappingBlocked ? <p style={{ color: "#f87171" }}>{error}</p> : null}
    </div>
  );
}
