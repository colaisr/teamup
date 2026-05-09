"use client";

import Link from "next/link";
import { useState } from "react";
import AiActionButton from "@/components/ai/AiActionButton";
import AiGeneratedBlock from "@/components/ai/AiGeneratedBlock";
import { explainAttentionTask, type AttentionExplainResult } from "@/lib/ai";
import { api, explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";
import { isAnalyticsMappingBlockedMessage } from "@/lib/mappingBlocked";
import { useActiveWorkspaceId } from "@/lib/workspace";

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
      const msg = explainApiError(err);
      setError(msg);
      setMappingBlocked(isAnalyticsMappingBlockedMessage(msg));
      setItems([]);
    }
  }

  async function explainTask(sourceTaskId: string) {
    if (!workspaceId.trim()) return;
    setError("");
    setAiBusyTaskId(sourceTaskId);
    try {
      const generated = await explainAttentionTask(workspaceId, sourceTaskId);
      setAiByTask((prev) => ({ ...prev, [sourceTaskId]: generated }));
    } catch (err: unknown) {
      const msg = explainApiError(err);
      setError(msg);
      setMappingBlocked(isAnalyticsMappingBlockedMessage(msg));
    } finally {
      setAiBusyTaskId("");
    }
  }

  return (
    <div className="grid">
      <h1>{t("attention.title")}</h1>
      <div className="card">
        <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder="workspace_id" />
        <button className="btn" style={{ marginLeft: 8 }} onClick={load}>
          Загрузить
        </button>
      </div>
      {items.map((item) => (
        <div key={item.source_task_id} className="card">
          <strong>{item.title}</strong>
          <p className="muted">ID: {item.source_task_id}</p>
          <p>Статус: {item.current_status || "-"}</p>
          <p>Скор: {item.attention_score}</p>
          <p>Причины: {item.reasons.join(", ")}</p>
          <p>Рекомендация: {item.suggested_action}</p>
          <AiActionButton busy={aiBusyTaskId === item.source_task_id} onClick={() => void explainTask(item.source_task_id)}>
            Объяснить через AI
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

