"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  transition_history_unavailable_reason?: string | null;
};

type WorkspaceItem = {
  id: string;
  name: string;
  is_current?: boolean;
};

type VisibleTaskRow = {
  row: TaskListItem;
  depth: number;
};

type AttentionFilter = "all" | "needsAttention" | "highAttention" | "noAttention";
type HierarchyFilter = "all" | "roots" | "subtasks";
type DueFilter = "all" | "overdue" | "dueSoon" | "noDue" | "completed";
type SortBy = "attention" | "updated" | "due" | "status" | "assignee";

function toDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDoneLike(row: TaskListItem): boolean {
  return row.normalized_status === "Done" || row.normalized_status === "Cancelled" || !!row.completed_at_source;
}

function getDueBucket(row: TaskListItem): "overdue" | "dueSoon" | "noDue" | "completed" {
  if (isDoneLike(row)) return "completed";
  const dueMs = toDateMs(row.due_at_source);
  if (!dueMs) return "noDue";
  const nowMs = Date.now();
  if (dueMs < nowMs) return "overdue";
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  if (dueMs - nowMs <= threeDaysMs) return "dueSoon";
  return "noDue";
}

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

function statusChipStyle(status: string | null): { bg: string; border: string; color: string } {
  const s = (status || "").toLowerCase();
  if (s.includes("blocked")) return { bg: "rgba(251,113,133,0.15)", border: "#9f1239", color: "#fecdd3" };
  if (s.includes("done") || s.includes("cancel")) return { bg: "rgba(74,222,128,0.15)", border: "#166534", color: "#bbf7d0" };
  if (s.includes("progress")) return { bg: "rgba(96,165,250,0.15)", border: "#1d4ed8", color: "#bfdbfe" };
  if (s.includes("review") || s.includes("qa")) return { bg: "rgba(250,204,21,0.15)", border: "#854d0e", color: "#fde68a" };
  return { bg: "rgba(148,163,184,0.15)", border: "#334155", color: "#cbd5e1" };
}

function attentionTone(score: number): { bg: string; color: string; border: string } {
  if (score >= 0.75) return { bg: "rgba(251,113,133,0.15)", color: "#fecdd3", border: "#be123c" };
  if (score > 0) return { bg: "rgba(250,204,21,0.15)", color: "#fde68a", border: "#a16207" };
  return { bg: "rgba(148,163,184,0.12)", color: "#cbd5e1", border: "#475569" };
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

export default function TasksPage() {
  const [workspaceId] = useActiveWorkspaceId("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("all");
  const [hierarchyFilter, setHierarchyFilter] = useState<HierarchyFilter>("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("attention");
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  async function loadWorkspaceMeta(activeId: string) {
    try {
      const workspaces = await api<WorkspaceItem[]>("/api/workspaces");
      const active = workspaces.find((item) => item.id === activeId) || workspaces.find((item) => item.is_current);
      setWorkspaceName(active?.name || "");
    } catch {
      setWorkspaceName("");
    }
  }

  async function loadTasks(activeWorkspaceId: string) {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: "1000",
        offset: "0",
      });
      const response = await api<TaskListResponse>(`/api/tasks/${activeWorkspaceId}?${params.toString()}`);
      setData(response);
      setExpandedIds(new Set());
    } catch (err: unknown) {
      setError(explainApiError(err));
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const active = workspaceId.trim();
    setSelectedTaskId("");
    setDetails(null);
    setAiResult(null);
    if (!active) {
      setData(null);
      setWorkspaceName("");
      return;
    }
    void Promise.all([loadWorkspaceMeta(active), loadTasks(active)]);
  }, [workspaceId]);

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

  function closeDetailsPanel() {
    setSelectedTaskId("");
    setDetails(null);
    setAiResult(null);
  }

  const sourceRows = useMemo(() => data?.items || [], [data]);
  const byId = useMemo(() => new Map(sourceRows.map((row) => [row.source_task_id, row])), [sourceRows]);
  const statusOptions = useMemo(
    () => Array.from(new Set(sourceRows.map((row) => row.normalized_status).filter(Boolean) as string[])).sort(),
    [sourceRows]
  );
  const assigneeOptions = useMemo(
    () => Array.from(new Set(sourceRows.map((row) => row.assignee_email).filter(Boolean) as string[])).sort(),
    [sourceRows]
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = sourceRows.filter((row) => {
      if (q) {
        const text = [
          row.title,
          row.source_task_id,
          row.current_status,
          row.normalized_status,
          row.assignee_email,
          row.parent_source_task_id,
          row.parent_title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(q)) return false;
      }

      if (statusFilter !== "all" && (row.normalized_status || "") !== statusFilter) return false;
      if (assigneeFilter === "unassigned" && row.assignee_email) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== "unassigned" && (row.assignee_email || "") !== assigneeFilter)
        return false;
      if (hierarchyFilter === "roots" && row.parent_source_task_id) return false;
      if (hierarchyFilter === "subtasks" && !row.parent_source_task_id) return false;
      if (attentionFilter === "needsAttention" && row.subtree_attention_score <= 0) return false;
      if (attentionFilter === "highAttention" && row.subtree_attention_score < 0.75) return false;
      if (attentionFilter === "noAttention" && row.subtree_attention_score > 0) return false;
      if (dueFilter !== "all" && getDueBucket(row) !== dueFilter) return false;
      return true;
    });

    const statusOrder: Record<string, number> = {
      Blocked: 0,
      "In Progress": 1,
      Review: 2,
      QA: 3,
      Ready: 4,
      "Not Started": 5,
      Done: 6,
      Cancelled: 7,
    };

    rows.sort((a, b) => {
      if (sortBy === "attention") {
        if (b.subtree_attention_score !== a.subtree_attention_score) {
          return b.subtree_attention_score - a.subtree_attention_score;
        }
        return b.self_attention_score - a.self_attention_score;
      }
      if (sortBy === "updated") {
        return (toDateMs(b.updated_at_source || b.created_at_source) || 0) - (toDateMs(a.updated_at_source || a.created_at_source) || 0);
      }
      if (sortBy === "due") {
        const aDue = toDateMs(a.due_at_source);
        const bDue = toDateMs(b.due_at_source);
        if (aDue === null && bDue === null) return 0;
        if (aDue === null) return 1;
        if (bDue === null) return -1;
        return aDue - bDue;
      }
      if (sortBy === "status") {
        const aOrder = statusOrder[a.normalized_status || ""] ?? 99;
        const bOrder = statusOrder[b.normalized_status || ""] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.title.localeCompare(b.title);
      }
      const aAssignee = (a.assignee_email || "").toLowerCase();
      const bAssignee = (b.assignee_email || "").toLowerCase();
      if (aAssignee !== bAssignee) return aAssignee.localeCompare(bAssignee);
      return a.title.localeCompare(b.title);
    });

    return rows;
  }, [sourceRows, query, statusFilter, assigneeFilter, hierarchyFilter, attentionFilter, dueFilter, sortBy]);

  const visibleRows = useMemo(() => buildVisibleRows(filteredRows, expandedIds), [filteredRows, expandedIds]);

  const summary = useMemo(() => {
    const needsAttention = filteredRows.filter((row) => row.subtree_attention_score > 0).length;
    const overdue = filteredRows.filter((row) => getDueBucket(row) === "overdue").length;
    const unassigned = filteredRows.filter((row) => !row.assignee_email).length;
    const activeTrees = filteredRows.filter((row) => !row.parent_source_task_id && row.open_descendant_count > 0).length;
    return {
      total: filteredRows.length,
      needsAttention,
      overdue,
      unassigned,
      activeTrees,
    };
  }, [filteredRows]);

  const detailParent = details?.task.parent_source_task_id ? byId.get(details.task.parent_source_task_id) : null;
  const detailChildren = details
    ? sourceRows
        .filter((row) => row.parent_source_task_id === details.task.source_task_id)
        .sort((a, b) => b.subtree_attention_score - a.subtree_attention_score)
    : [];

  const deterministicInsight = details?.task.attention_reasons.length
    ? details.task.attention_reasons.join(" · ")
    : t("tasks.insightNone");

  const pageReady = !!workspaceId.trim();
  const activeFilterCount = [
    statusFilter !== "all",
    assigneeFilter !== "all",
    attentionFilter !== "all",
    hierarchyFilter !== "all",
    dueFilter !== "all",
    sortBy !== "attention",
  ].filter(Boolean).length;

  return (
    <div className="grid" style={{ width: "min(1380px, 100%)" }}>
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0 }}>{t("tasks.title")}</h1>
            <p className="muted" style={{ marginBottom: 0 }}>
              {t("tasks.hint")}
            </p>
          </div>
          <button type="button" className="btn btnGhost" disabled={!pageReady || busy} onClick={() => void loadTasks(workspaceId)}>
            {busy ? `${t("common.loading")}...` : t("tasks.refresh")}
          </button>
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            width: "fit-content",
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #334155",
            background: "#0b1220",
            color: "#cbd5e1",
            fontSize: 13,
          }}
        >
          <span>{t("tasks.workspaceLabel")}:</span>
          <strong style={{ color: "#e2e8f0", fontWeight: 600 }}>{workspaceName || t("tasks.workspaceUnknown")}</strong>
        </div>
      </div>

      {!pageReady ? (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <strong>{t("tasks.noWorkspaceTitle")}</strong>
          <p className="muted" style={{ margin: 0 }}>
            {t("tasks.noWorkspaceBody")}
          </p>
          <div>
            <Link href="/settings/user?tab=workspaces" className="btn">
              {t("tasks.openWorkspaceSettings")}
            </Link>
          </div>
        </div>
      ) : null}

      {pageReady ? (
        <>
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 10,
            }}
          >
            {[
              { key: "tasks.summary.total", value: summary.total },
              { key: "tasks.summary.attention", value: summary.needsAttention },
              { key: "tasks.summary.overdue", value: summary.overdue },
              { key: "tasks.summary.unassigned", value: summary.unassigned },
              { key: "tasks.summary.activeTrees", value: summary.activeTrees },
            ].map((item) => (
              <div key={item.key} className="card" style={{ padding: 12, display: "grid", gap: 4 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  {t(item.key)}
                </span>
                <strong style={{ fontSize: 22 }}>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) auto", gap: 10, alignItems: "center" }}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("tasks.searchPlaceholder")} />
              <button type="button" className="btn btnGhost" onClick={() => setFiltersOpen((value) => !value)}>
                {filtersOpen ? t("tasks.filters.hide") : t("tasks.filters.show")}
                {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
              </button>
            </div>
            {filtersOpen ? (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 10,
                  paddingTop: 10,
                  borderTop: "1px solid #1f2937",
                }}
              >
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">{t("tasks.filter.status.all")}</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
                  <option value="all">{t("tasks.filter.assignee.all")}</option>
                  <option value="unassigned">{t("tasks.filter.assignee.unassigned")}</option>
                  {assigneeOptions.map((assignee) => (
                    <option key={assignee} value={assignee}>
                      {assignee}
                    </option>
                  ))}
                </select>
                <select value={attentionFilter} onChange={(event) => setAttentionFilter(event.target.value as AttentionFilter)}>
                  <option value="all">{t("tasks.filter.attention.all")}</option>
                  <option value="needsAttention">{t("tasks.filter.attention.needsAttention")}</option>
                  <option value="highAttention">{t("tasks.filter.attention.highAttention")}</option>
                  <option value="noAttention">{t("tasks.filter.attention.noAttention")}</option>
                </select>
                <select value={hierarchyFilter} onChange={(event) => setHierarchyFilter(event.target.value as HierarchyFilter)}>
                  <option value="all">{t("tasks.filter.hierarchy.all")}</option>
                  <option value="roots">{t("tasks.filter.hierarchy.roots")}</option>
                  <option value="subtasks">{t("tasks.filter.hierarchy.subtasks")}</option>
                </select>
                <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueFilter)}>
                  <option value="all">{t("tasks.filter.due.all")}</option>
                  <option value="overdue">{t("tasks.filter.due.overdue")}</option>
                  <option value="dueSoon">{t("tasks.filter.due.dueSoon")}</option>
                  <option value="noDue">{t("tasks.filter.due.noDue")}</option>
                  <option value="completed">{t("tasks.filter.due.completed")}</option>
                </select>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
                  <option value="attention">{t("tasks.sort.attention")}</option>
                  <option value="updated">{t("tasks.sort.updated")}</option>
                  <option value="due">{t("tasks.sort.due")}</option>
                  <option value="status">{t("tasks.sort.status")}</option>
                  <option value="assignee">{t("tasks.sort.assignee")}</option>
                </select>
              </div>
            ) : null}
            <p className="muted" style={{ margin: 0 }}>
              {t("tasks.totalPrefix")}: {data?.total || 0} · {t("tasks.returnedPrefix")}: {visibleRows.length}
              {activeFilterCount > 0 && !filtersOpen ? ` · ${t("tasks.filters.active")}: ${activeFilterCount}` : ""}
            </p>
          </div>

          <div className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
            {busy && !data ? (
              <p className="muted" style={{ margin: 0 }}>
                {t("tasks.loadingData")}
              </p>
            ) : null}
            {!busy && data && filteredRows.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                {t("tasks.noData")}
              </p>
            ) : null}
            {data && filteredRows.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {visibleRows.map(({ row, depth }) => {
                  const statusTone = statusChipStyle(row.normalized_status);
                  const attentionBadge = attentionTone(row.subtree_attention_score);
                  const dueBucket = getDueBucket(row);
                  const isExpanded = expandedIds.has(row.source_task_id);
                  return (
                    <article
                      key={`${row.connection_id || ""}:${row.source_task_id}`}
                      style={{
                        display: "grid",
                        gap: 10,
                        padding: "12px 12px 12px 10px",
                        marginLeft: Math.min(depth * 18, 72),
                        border: "1px solid #1f2937",
                        borderLeft: depth > 0 ? "3px solid #334155" : "1px solid #1f2937",
                        borderRadius: 12,
                        background: depth > 0 ? "rgba(15,23,42,0.68)" : "#0b1220",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => row.child_count > 0 && toggleExpanded(row.source_task_id)}
                          disabled={row.child_count === 0}
                          aria-label={isExpanded ? t("tasks.collapse") : t("tasks.expand")}
                          aria-expanded={row.child_count > 0 ? isExpanded : undefined}
                          title={row.child_count > 0 ? t("tasks.treeToggleDirect") : undefined}
                          style={{
                            width: 28,
                            height: 28,
                            flexShrink: 0,
                            display: "grid",
                            placeItems: "center",
                            border: row.child_count > 0 ? "1px solid #334155" : "1px solid transparent",
                            borderRadius: 8,
                            background: row.child_count > 0 ? "rgba(15,23,42,0.9)" : "transparent",
                            color: row.child_count > 0 ? "#cbd5e1" : "transparent",
                            cursor: row.child_count > 0 ? "pointer" : "default",
                          }}
                        >
                          {row.child_count > 0 ? <ChevronIcon expanded={isExpanded} /> : null}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 14, lineHeight: 1.35 }}>{row.title}</strong>
                            {row.is_subtask ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                  fontSize: 11,
                                  border: "1px solid #334155",
                                  color: "#cbd5e1",
                                  background: "rgba(148,163,184,0.12)",
                                }}
                              >
                                {t("tasks.subtaskBadge")}
                              </span>
                            ) : null}
                          </div>
                          <div className="muted" style={{ marginTop: 3, fontSize: 12 }}>
                            ID: {row.source_task_id}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btnGhost"
                          style={{ padding: "5px 10px", flexShrink: 0 }}
                          onClick={() => void openTaskDetails(row.source_task_id, includeSubtasksInDetails)}
                        >
                          {t("tasks.detailsBtn")}
                        </button>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
                          gap: 10,
                          paddingLeft: row.child_count > 0 ? 38 : 0,
                        }}
                      >
                        <div>
                          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                            {t("tasks.col.status")}
                          </div>
                          <span
                            style={{
                              display: "inline-block",
                              borderRadius: 999,
                              border: `1px solid ${statusTone.border}`,
                              background: statusTone.bg,
                              color: statusTone.color,
                              padding: "3px 10px",
                              fontSize: 12,
                            }}
                          >
                            {row.normalized_status || "—"}
                          </span>
                          <div className="muted" style={{ marginTop: 5, fontSize: 12 }}>
                            {row.current_status || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                            {t("tasks.col.owner")}
                          </div>
                          {row.assignee_email ? (
                            <span style={{ overflowWrap: "anywhere" }}>{row.assignee_email}</span>
                          ) : (
                            <span
                              style={{
                                display: "inline-block",
                                borderRadius: 999,
                                border: "1px solid #7c2d12",
                                background: "rgba(251,146,60,0.14)",
                                color: "#fdba74",
                                padding: "3px 10px",
                                fontSize: 12,
                              }}
                            >
                              {t("tasks.unassigned")}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                            {t("tasks.col.attention")}
                          </div>
                          <span
                            style={{
                              display: "inline-block",
                              borderRadius: 999,
                              border: `1px solid ${attentionBadge.border}`,
                              background: attentionBadge.bg,
                              color: attentionBadge.color,
                              padding: "3px 10px",
                              fontSize: 12,
                            }}
                          >
                            {t("tasks.attentionSubtree")}: {row.subtree_attention_score}
                          </span>
                          <div className="muted" style={{ marginTop: 5, fontSize: 12 }}>
                            {t("tasks.attentionSelf")}: {row.self_attention_score}
                          </div>
                          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                            {row.attention_reasons.length > 0 ? row.attention_reasons.slice(0, 2).join(" · ") : t("tasks.insightNone")}
                          </div>
                        </div>
                        <div>
                          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                            {t("tasks.col.relations")}
                          </div>
                          <div>{t("tasks.relationsChildren")}: {row.child_count}</div>
                          <div className="muted">{t("tasks.relationsOpenDescendants")}: {row.open_descendant_count}</div>
                          <div className="muted">{t("tasks.relationsDescendants")}: {row.descendant_count}</div>
                        </div>
                        <div>
                          <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                            {t("tasks.col.dates")}
                          </div>
                          <span
                            style={{
                              display: "inline-block",
                              borderRadius: 999,
                              border: "1px solid #334155",
                              background:
                                dueBucket === "overdue"
                                  ? "rgba(251,113,133,0.14)"
                                  : dueBucket === "dueSoon"
                                    ? "rgba(250,204,21,0.14)"
                                    : "rgba(148,163,184,0.1)",
                              color:
                                dueBucket === "overdue"
                                  ? "#fecdd3"
                                  : dueBucket === "dueSoon"
                                    ? "#fde68a"
                                    : "#cbd5e1",
                              padding: "3px 10px",
                              fontSize: 12,
                            }}
                          >
                            {t(`tasks.filter.due.${dueBucket}`)}
                          </span>
                          <div className="muted" style={{ marginTop: 5 }}>
                            {t("tasks.dateDue")}: {formatApiUtcAsLocal(row.due_at_source) || "—"}
                          </div>
                          <div className="muted">{t("tasks.dateUpdated")}: {formatApiUtcAsLocal(row.updated_at_source) || "—"}</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
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
              width: "min(680px, 96vw)",
              background: "#020817",
              borderLeft: "1px solid #334155",
              zIndex: 60,
              overflowY: "auto",
              padding: 16,
              display: "grid",
              gap: 12,
              alignContent: "start",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{t("tasks.detailsTitle")}</strong>
              <button type="button" className="btn btnGhost" onClick={closeDetailsPanel}>
                {t("common.close")}
              </button>
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
                <div className="card" style={{ display: "grid", gap: 8 }}>
                  <strong>{details.task.title}</strong>
                  <div className="muted">ID: {details.task.source_task_id}</div>
                  <div className="muted">{t("tasks.statusNorm")}: {details.task.normalized_status || "—"}</div>
                  <div className="muted">{t("tasks.labelAssignee")}: {details.task.assignee_email || t("tasks.unassigned")}</div>
                </div>

                <div className="grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div className="card" style={{ padding: 12 }}>
                    {t("tasks.attentionSelf")}: <strong>{details.task.self_attention_score}</strong>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    {t("tasks.attentionSubtree")}: <strong>{details.task.subtree_attention_score}</strong>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    {t("tasks.relationsChildren")}: <strong>{details.task.child_count}</strong>
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    {t("tasks.relationsOpenDescendants")}: <strong>{details.task.open_descendant_count}</strong>
                  </div>
                </div>

                <div className="card" style={{ display: "grid", gap: 8 }}>
                  <strong>{t("tasks.insightTitle")}</strong>
                  <p style={{ margin: 0 }}>{deterministicInsight}</p>
                </div>

                <div className="card" style={{ display: "grid", gap: 8 }}>
                  <strong>{t("tasks.relatedTitle")}</strong>
                  {detailParent ? (
                    <div style={{ display: "grid", gap: 4 }}>
                      <span className="muted">{t("tasks.relationsParent")}</span>
                      <button
                        type="button"
                        className="btn btnGhost"
                        style={{ justifyContent: "flex-start" }}
                        onClick={() => void openTaskDetails(detailParent.source_task_id, includeSubtasksInDetails)}
                      >
                        {detailParent.title}
                      </button>
                    </div>
                  ) : null}
                  {detailChildren.length > 0 ? (
                    <div style={{ display: "grid", gap: 4 }}>
                      <span className="muted">{t("tasks.relationsChildren")}</span>
                      {detailChildren.slice(0, 5).map((child) => (
                        <button
                          key={child.source_task_id}
                          type="button"
                          className="btn btnGhost"
                          style={{ justifyContent: "flex-start" }}
                          onClick={() => void openTaskDetails(child.source_task_id, includeSubtasksInDetails)}
                        >
                          {child.title}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {!detailParent && detailChildren.length === 0 ? <span className="muted">{t("tasks.relatedEmpty")}</span> : null}
                </div>

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

                <div className="card" style={{ display: "grid", gap: 8 }}>
                  <strong>{t("tasks.transitionTimeline")}</strong>
                  {details.transition_history_unavailable_reason ? (
                    <p className="muted" style={{ margin: 0 }}>
                      {t("tasks.transitionsUnavailableProviderPlan")}
                    </p>
                  ) : null}
                  {details.transitions.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      {t("tasks.noTransitions")}
                    </p>
                  ) : (
                    <div style={{ marginTop: 2, display: "grid", gap: 6 }}>
                      {details.transitions.map((transition, idx) => (
                        <div key={`${transition.task_source_id}-${transition.transitioned_at}-${idx}`} className="muted">
                          [{formatApiUtcAsLocal(transition.transitioned_at)}] {transition.task_source_id}: {transition.from_status || "—"} →{" "}
                          {transition.to_status}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="muted" style={{ margin: 0 }}>
                    {t("tasks.descendantsInScope")}: {details.descendant_task_ids.length}
                  </p>
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
