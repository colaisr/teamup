"use client";

import { useMemo, useState } from "react";
import AiActionButton from "@/components/ai/AiActionButton";
import AiGeneratedBlock from "@/components/ai/AiGeneratedBlock";
import { explainAttentionTask, type AttentionExplainResult } from "@/lib/ai";
import { api, explainApiError } from "@/lib/api";
import { formatApiUtcAsLocal } from "@/lib/datetime";
import { t } from "@/lib/i18n";
import { useActiveWorkspaceId } from "@/lib/workspace";

type TaskListItem = {
  source_task_id: string;
  parent_source_task_id: string | null;
  title: string;
  current_status: string | null;
  normalized_status: string | null;
  assignee_email: string | null;
  created_at_source: string | null;
  due_at_source: string | null;
  completed_at_source: string | null;
  updated_at_source: string | null;
  last_synced_at: string;
  connection_id: string | null;
  self_attention_score: number;
  subtree_attention_score: number;
  attention_reasons: string[];
  child_count: number;
  descendant_count: number;
  open_descendant_count: number;
  is_subtask: boolean;
  parent_title: string | null;
};

type TaskListResponse = {
  workspace_id: string;
  total: number;
  returned: number;
  items: TaskListItem[];
};

type TaskTimelineEntry = {
  task_source_id: string;
  from_status: string | null;
  to_status: string;
  transitioned_at: string;
};

type TaskDetailsResponse = {
  workspace_id: string;
  source_task_id: string;
  include_subtasks: boolean;
  descendant_task_ids: string[];
  task: TaskListItem;
  transitions: TaskTimelineEntry[];
};

type VisibleTaskRow = {
  row: TaskListItem;
  depth: number;
};

function buildChildrenIndex(items: TaskListItem[]): Map<string, TaskListItem[]> {
  const byId = new Map(items.map((item) => [item.source_task_id, item]));
  const childrenByParent = new Map<string, TaskListItem[]>();
  for (const item of items) {
    if (!item.parent_source_task_id || !byId.has(item.parent_source_task_id)) continue;
    const bucket = childrenByParent.get(item.parent_source_task_id) || [];
    bucket.push(item);
    childrenByParent.set(item.parent_source_task_id, bucket);
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) => b.subtree_attention_score - a.subtree_attention_score);
  }
  return childrenByParent;
}

function buildVisibleRows(items: TaskListItem[], expandedIds: Set<string>): VisibleTaskRow[] {
  const byId = new Map(items.map((item) => [item.source_task_id, item]));
  const childrenByParent = buildChildrenIndex(items);

  const roots = items
    .filter((item) => !item.parent_source_task_id || !byId.has(item.parent_source_task_id))
    .sort((a, b) => b.subtree_attention_score - a.subtree_attention_score);

  const visible: VisibleTaskRow[] = [];
  const visit = (row: TaskListItem, depth: number) => {
    visible.push({ row, depth });
    if (!expandedIds.has(row.source_task_id)) return;
    for (const child of childrenByParent.get(row.source_task_id) || []) {
      visit(child, depth + 1);
    }
  };
  for (const root of roots) visit(root, 0);
  return visible;
}

function collectSubtreeIds(sourceTaskId: string, childrenByParent: Map<string, TaskListItem[]>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [...(childrenByParent.get(sourceTaskId) || [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    if (seen.has(current.source_task_id)) continue;
    seen.add(current.source_task_id);
    out.push(current.source_task_id);
    stack.push(...(childrenByParent.get(current.source_task_id) || []));
  }
  return out;
}

export default function TasksPage() {
  const [workspaceId, setWorkspaceId] = useActiveWorkspaceId("");
  const [query, setQuery] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [rootsOnly, setRootsOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<TaskListResponse | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [details, setDetails] = useState<TaskDetailsResponse | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [includeSubtasksInDetails, setIncludeSubtasksInDetails] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiIncludeSubtasks, setAiIncludeSubtasks] = useState(true);
  const [aiResult, setAiResult] = useState<AttentionExplainResult | null>(null);

  async function load() {
    if (!workspaceId.trim()) return;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: "400",
        offset: "0",
        only_attention: String(onlyAttention),
        roots_only: String(rootsOnly),
      });
      if (query.trim()) params.set("query", query.trim());
      const response = await api<TaskListResponse>(`/api/tasks/${workspaceId}?${params.toString()}`);
      setData(response);
      setExpandedIds(new Set());
    } catch (err: unknown) {
      setError(explainApiError(err));
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  async function openTaskDetails(sourceTaskId: string, includeSubtasks: boolean) {
    if (!workspaceId.trim()) return;
    setSelectedTaskId(sourceTaskId);
    setDetailsBusy(true);
    setError("");
    try {
      const response = await api<TaskDetailsResponse>(
        `/api/tasks/${workspaceId}/${encodeURIComponent(sourceTaskId)}/details?include_subtasks=${String(includeSubtasks)}`
      );
      setDetails(response);
      setAiResult(null);
    } catch (err: unknown) {
      setError(explainApiError(err));
      setDetails(null);
    } finally {
      setDetailsBusy(false);
    }
  }

  async function explainSelectedTask() {
    if (!workspaceId.trim() || !selectedTaskId.trim()) return;
    setAiBusy(true);
    setError("");
    try {
      const generated = await explainAttentionTask(workspaceId, selectedTaskId, undefined, aiIncludeSubtasks);
      setAiResult(generated);
    } catch (err: unknown) {
      setError(explainApiError(err));
      setAiResult(null);
    } finally {
      setAiBusy(false);
    }
  }

  function toggleExpanded(sourceTaskId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceTaskId)) next.delete(sourceTaskId);
      else next.add(sourceTaskId);
      return next;
    });
  }

  function expandSubtree(sourceTaskId: string) {
    if (!data) return;
    const descendants = collectSubtreeIds(sourceTaskId, buildChildrenIndex(data.items));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(sourceTaskId);
      for (const id of descendants) next.add(id);
      return next;
    });
  }

  function collapseSubtree(sourceTaskId: string) {
    if (!data) return;
    const descendants = collectSubtreeIds(sourceTaskId, buildChildrenIndex(data.items));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(sourceTaskId);
      for (const id of descendants) next.delete(id);
      return next;
    });
  }

  function closeDetailsPanel() {
    setSelectedTaskId("");
    setDetails(null);
    setAiResult(null);
  }

  const visibleRows = useMemo(
    () => (data ? buildVisibleRows(data.items, expandedIds) : []),
    [data, expandedIds]
  );

  return (
    <div className="grid">
      <h1>{t("tasks.title")}</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        {t("tasks.hint")}
      </p>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <input value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} placeholder={t("tasks.workspacePlaceholder")} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("tasks.searchPlaceholder")}
        />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={onlyAttention} onChange={(event) => setOnlyAttention(event.target.checked)} />
          {t("tasks.onlyAttention")}
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={rootsOnly} onChange={(event) => setRootsOnly(event.target.checked)} />
          {t("tasks.rootsOnly")}
        </label>
        <div>
          <button className="btn" disabled={busy || !workspaceId.trim()} onClick={() => void load()}>
            {busy ? `${t("common.loading")}...` : t("tasks.load")}
          </button>
        </div>
      </div>

      {data ? (
        <div className="card" style={{ overflowX: "auto" }}>
          <p className="muted" style={{ marginTop: 0 }}>
            {t("tasks.totalPrefix")}: {data.total} · {t("tasks.returnedPrefix")}: {data.returned}
          </p>
          {data.items.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              {t("tasks.noData")}
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>{t("tasks.col.title")}</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>{t("tasks.col.status")}</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>{t("tasks.col.relations")}</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>{t("tasks.col.attention")}</th>
                  <th style={{ textAlign: "left", padding: "8px 6px" }}>{t("tasks.col.dates")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ row, depth }) => (
                  <tr key={`${row.connection_id || ""}:${row.source_task_id}`} style={{ borderTop: "1px solid #1f2937" }}>
                    <td style={{ verticalAlign: "top", padding: "8px 6px", minWidth: 320 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <div style={{ width: depth * 14 }} />
                        {row.child_count > 0 ? (
                          <div style={{ display: "grid", gap: 4 }}>
                            <button
                              type="button"
                              className="btn btnGhost"
                              style={{ padding: "2px 6px", minWidth: 30 }}
                              onClick={() => toggleExpanded(row.source_task_id)}
                              title={t("tasks.treeToggleDirect")}
                            >
                              {expandedIds.has(row.source_task_id) ? "−" : "+"}
                            </button>
                            <button
                              type="button"
                              className="btn btnGhost"
                              style={{ padding: "2px 6px", minWidth: 30 }}
                              onClick={() => expandSubtree(row.source_task_id)}
                              title={t("tasks.treeExpandSubtree")}
                            >
                              ++
                            </button>
                            <button
                              type="button"
                              className="btn btnGhost"
                              style={{ padding: "2px 6px", minWidth: 30 }}
                              onClick={() => collapseSubtree(row.source_task_id)}
                              title={t("tasks.treeCollapseSubtree")}
                            >
                              --
                            </button>
                          </div>
                        ) : (
                          <span style={{ width: 30, textAlign: "center", color: "#64748b" }}>·</span>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{row.title}</div>
                          <div className="muted">
                            {t("tasks.labelId")}: {row.source_task_id}
                          </div>
                          {row.assignee_email ? (
                            <div className="muted">
                              {t("tasks.labelAssignee")}: {row.assignee_email}
                            </div>
                          ) : null}
                          {row.is_subtask ? <div className="muted">{t("tasks.subtaskBadge")}</div> : null}
                          <button
                            type="button"
                            className="btn btnGhost"
                            style={{ marginTop: 6, padding: "4px 8px" }}
                            onClick={() => void openTaskDetails(row.source_task_id, includeSubtasksInDetails)}
                          >
                            {t("tasks.detailsBtn")}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px 6px", minWidth: 180 }}>
                      <div>
                        {t("tasks.statusRaw")}: {row.current_status || "—"}
                      </div>
                      <div className="muted">
                        {t("tasks.statusNorm")}: {row.normalized_status || "—"}
                      </div>
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px 6px", minWidth: 240 }}>
                      <div>
                        {t("tasks.relationsChildren")}: {row.child_count}
                      </div>
                      <div className="muted">
                        {t("tasks.relationsDescendants")}: {row.descendant_count}
                      </div>
                      <div className="muted">
                        {t("tasks.relationsOpenDescendants")}: {row.open_descendant_count}
                      </div>
                      {row.parent_source_task_id ? (
                        <div className="muted" title={row.parent_title || undefined}>
                          {t("tasks.relationsParent")}: {row.parent_source_task_id}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px 6px", minWidth: 240 }}>
                      <div>
                        {t("tasks.attentionSelf")}: {row.self_attention_score}
                      </div>
                      <div>
                        {t("tasks.attentionSubtree")}: {row.subtree_attention_score}
                      </div>
                      {row.attention_reasons.length > 0 ? (
                        <div className="muted">
                          {t("tasks.attentionReasons")}: {row.attention_reasons.join(", ")}
                        </div>
                      ) : (
                        <div className="muted">
                          {t("tasks.attentionReasons")}: —
                        </div>
                      )}
                    </td>
                    <td style={{ verticalAlign: "top", padding: "8px 6px", minWidth: 240 }}>
                      <div className="muted">
                        {t("tasks.dateUpdated")}: {formatApiUtcAsLocal(row.updated_at_source) || "—"}
                      </div>
                      <div className="muted">
                        {t("tasks.dateDue")}: {formatApiUtcAsLocal(row.due_at_source) || "—"}
                      </div>
                      <div className="muted">
                        {t("tasks.dateDone")}: {formatApiUtcAsLocal(row.completed_at_source) || "—"}
                      </div>
                      <div className="muted">
                        {t("tasks.dateLastSync")}: {formatApiUtcAsLocal(row.last_synced_at) || "—"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {(detailsBusy || details || selectedTaskId) && (
        <>
          <div
            role="presentation"
            onClick={closeDetailsPanel}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(2,6,23,0.55)",
              zIndex: 50,
            }}
          />
          <aside
            aria-label={t("tasks.detailsPanelAria")}
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(620px, 96vw)",
              background: "#020817",
              borderLeft: "1px solid #334155",
              zIndex: 60,
              overflowY: "auto",
              padding: 16,
              display: "grid",
              gap: 10,
              alignContent: "start",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{t("tasks.detailsTitle")}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {selectedTaskId ? <span className="muted">{selectedTaskId}</span> : null}
                <button type="button" className="btn btnGhost" onClick={closeDetailsPanel}>
                  {t("common.close")}
                </button>
              </div>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={includeSubtasksInDetails}
                onChange={(event) => setIncludeSubtasksInDetails(event.target.checked)}
              />
              {t("tasks.includeSubtasksInTimeline")}
            </label>
            {selectedTaskId ? (
              <button
                type="button"
                className="btn btnGhost"
                disabled={detailsBusy}
                onClick={() => void openTaskDetails(selectedTaskId, includeSubtasksInDetails)}
              >
                {detailsBusy ? `${t("common.loading")}...` : t("tasks.reloadDetails")}
              </button>
            ) : null}

            {details ? (
              <>
                <p className="muted" style={{ margin: 0 }}>
                  {t("tasks.descendantsInScope")}: {details.descendant_task_ids.length}
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={aiIncludeSubtasks}
                      onChange={(event) => setAiIncludeSubtasks(event.target.checked)}
                    />
                    {t("tasks.aiIncludeSubtasks")}
                  </label>
                  <AiActionButton busy={aiBusy} onClick={() => void explainSelectedTask()}>
                    {t("tasks.explainWithAi")}
                  </AiActionButton>
                </div>
                {aiResult ? (
                  <AiGeneratedBlock
                    summary={aiResult.summary}
                    takeaways={aiResult.takeaways}
                    recommendedActions={aiResult.recommended_actions}
                    limitations={aiResult.limitations}
                    evidenceRefs={aiResult.evidence_refs}
                  />
                ) : null}

                <div>
                  <strong>{t("tasks.transitionTimeline")}</strong>
                  {details.transitions.length === 0 ? (
                    <p className="muted" style={{ marginBottom: 0 }}>
                      {t("tasks.noTransitions")}
                    </p>
                  ) : (
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {details.transitions.map((transition, idx) => (
                        <div key={`${transition.task_source_id}-${transition.transitioned_at}-${idx}`} className="muted">
                          [{formatApiUtcAsLocal(transition.transitioned_at)}] {transition.task_source_id}:{" "}
                          {transition.from_status || "—"} → {transition.to_status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </aside>
        </>
      )}

      {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}
    </div>
  );
}
