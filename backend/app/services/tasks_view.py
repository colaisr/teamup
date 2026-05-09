from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Task
from app.schemas import TaskListItemOut
from app.services.analytics_engine import compute_attention_rows, normalize_status, active_mapping_by_connection


def _is_done_like(normalized_status: str | None) -> bool:
    return normalized_status in {"Done", "Cancelled"}


def build_task_list_items(
    db: Session,
    workspace_id: str,
    *,
    query: str | None = None,
    only_attention: bool = False,
    roots_only: bool = False,
) -> list[TaskListItemOut]:
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    mapping = active_mapping_by_connection(db, workspace_id)
    attention_rows = compute_attention_rows(db, workspace_id, limit=None)
    attention_by_id = {row.source_task_id: row for row in attention_rows}

    task_by_source: dict[str, Task] = {t.source_task_id: t for t in tasks if t.source_task_id}
    children_by_parent: dict[str, list[str]] = defaultdict(list)
    for task in tasks:
        if task.parent_source_task_id:
            children_by_parent[task.parent_source_task_id].append(task.source_task_id)

    normalized_by_id: dict[str, str | None] = {}
    for task in tasks:
        normalized_by_id[task.source_task_id] = normalize_status(mapping, task.connection_id, task.current_status)

    descendants_cache: dict[str, set[str]] = {}

    def descendant_ids(source_task_id: str, trail: set[str] | None = None) -> set[str]:
        if source_task_id in descendants_cache:
            return descendants_cache[source_task_id]
        seen = set() if trail is None else set(trail)
        if source_task_id in seen:
            return set()
        seen.add(source_task_id)
        out: set[str] = set()
        for child_id in children_by_parent.get(source_task_id, []):
            out.add(child_id)
            out.update(descendant_ids(child_id, seen))
        descendants_cache[source_task_id] = out
        return out

    subtree_attention_cache: dict[str, float] = {}

    def subtree_attention(source_task_id: str) -> float:
        if source_task_id in subtree_attention_cache:
            return subtree_attention_cache[source_task_id]
        self_score = float(getattr(attention_by_id.get(source_task_id), "attention_score", 0.0) or 0.0)
        child_max = 0.0
        for child_id in children_by_parent.get(source_task_id, []):
            child_max = max(child_max, subtree_attention(child_id))
        total = round(max(self_score, child_max), 3)
        subtree_attention_cache[source_task_id] = total
        return total

    q = (query or "").strip().lower()
    items: list[TaskListItemOut] = []
    for task in tasks:
        source_id = task.source_task_id
        if not source_id:
            continue
        self_attention = float(getattr(attention_by_id.get(source_id), "attention_score", 0.0) or 0.0)
        subtree_score = subtree_attention(source_id)
        if only_attention and subtree_score <= 0:
            continue
        if roots_only and task.parent_source_task_id:
            continue

        parent_title = None
        if task.parent_source_task_id and task.parent_source_task_id in task_by_source:
            parent_title = task_by_source[task.parent_source_task_id].title

        normalized_status = normalized_by_id[source_id]
        descendants = descendant_ids(source_id)
        open_descendants = sum(1 for cid in descendants if not _is_done_like(normalized_by_id.get(cid)))

        item = TaskListItemOut(
            source_task_id=source_id,
            parent_source_task_id=task.parent_source_task_id,
            title=task.title,
            current_status=task.current_status,
            normalized_status=normalized_status,
            assignee_email=task.assignee_email,
            created_at_source=task.created_at_source,
            due_at_source=task.due_at_source,
            completed_at_source=task.completed_at_source,
            updated_at_source=task.updated_at_source,
            last_synced_at=task.last_synced_at,
            connection_id=task.connection_id,
            self_attention_score=round(self_attention, 3),
            subtree_attention_score=subtree_score,
            attention_reasons=list(getattr(attention_by_id.get(source_id), "reasons", []) or []),
            child_count=len(children_by_parent.get(source_id, [])),
            descendant_count=len(descendants),
            open_descendant_count=open_descendants,
            is_subtask=bool(task.parent_source_task_id),
            parent_title=parent_title,
        )
        if q:
            text = " ".join(
                [
                    item.source_task_id,
                    item.title or "",
                    item.current_status or "",
                    item.normalized_status or "",
                    item.assignee_email or "",
                    item.parent_source_task_id or "",
                    item.parent_title or "",
                ]
            ).lower()
            if q not in text:
                continue
        items.append(item)

    def sort_key(row: TaskListItemOut) -> tuple[float, float, datetime]:
        updated = row.updated_at_source or row.created_at_source or row.last_synced_at
        return (row.subtree_attention_score, row.self_attention_score, updated)

    items.sort(key=sort_key, reverse=True)
    return items
