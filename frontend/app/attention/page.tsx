"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type AttentionTask = {
  source_task_id: string;
  title: string;
  current_status: string | null;
  attention_score: number;
  reasons: string[];
  suggested_action: string;
};

export default function AttentionPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [items, setItems] = useState<AttentionTask[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setWorkspaceId(localStorage.getItem("teamup_workspace_id") || "");
  }, []);

  async function load() {
    if (!workspaceId) return;
    setError("");
    try {
      setItems(await api<AttentionTask[]>(`/api/analytics/attention/${workspaceId}`));
    } catch (err: any) {
      setError(err.message || "Failed");
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
        </div>
      ))}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}

