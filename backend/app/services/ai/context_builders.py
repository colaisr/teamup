from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import Task, TaskTransition
from app.services.analytics_engine import compute_attention_rows, compute_metrics_payload


def _descendants_by_parent(tasks: list[Task]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = defaultdict(list)
    for task in tasks:
        if task.parent_source_task_id:
            out[task.parent_source_task_id].append(task.source_task_id)
    return out


def _collect_descendants(children_by_parent: dict[str, list[str]], source_task_id: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    stack = list(children_by_parent.get(source_task_id, []))
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        out.append(current)
        stack.extend(children_by_parent.get(current, []))
    return out


def build_attention_task_context(
    db: Session,
    *,
    workspace_id: str,
    source_task_id: str,
    include_subtasks: bool = False,
) -> dict:
    metrics = compute_metrics_payload(db, workspace_id)
    # Include every task with attention score > 0 (not only the UI default top-N),
    # otherwise explain-by-id fails for lower-ranked items that are still in scope.
    attention_items = compute_attention_rows(db, workspace_id, limit=None)
    attention_by_id = {item.source_task_id: item for item in attention_items}

    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    task_by_id = {task.source_task_id: task for task in tasks}
    task = task_by_id.get(source_task_id)
    if task is None:
        raise ValueError("Task is not found in the workspace")

    descendants = _collect_descendants(_descendants_by_parent(tasks), source_task_id) if include_subtasks else []
    scoped_task_ids = [source_task_id, *descendants]

    contributors = [attention_by_id[tid] for tid in scoped_task_ids if tid in attention_by_id]
    target = attention_by_id.get(source_task_id)
    if not contributors:
        raise ValueError(
            "Task and subtasks are not in the current attention list"
            if include_subtasks
            else "Task is not in the current attention list"
        )

    effective_score = max(item.attention_score for item in contributors)
    reason_seen: set[str] = set()
    reason_pool: list[str] = []
    for item in sorted(contributors, key=lambda x: x.attention_score, reverse=True):
        for reason in item.reasons:
            if reason not in reason_seen:
                reason_seen.add(reason)
                reason_pool.append(reason)

    transitions = (
        db.query(TaskTransition)
        .filter(
            TaskTransition.workspace_id == workspace_id,
            TaskTransition.task_source_id.in_(scoped_task_ids),
        )
        .order_by(TaskTransition.transitioned_at.asc())
        .all()
    )
    transition_slice = transitions[-16:]

    return {
        "workspace_id": workspace_id,
        "task": {
            "source_task_id": source_task_id,
            "title": task.title,
            "current_status": task.current_status,
            "updated_at_source": task.updated_at_source.isoformat() if task.updated_at_source else None,
            "due_at_source": task.due_at_source.isoformat() if task.due_at_source else None,
            "completed_at_source": task.completed_at_source.isoformat() if task.completed_at_source else None,
            "include_subtasks": include_subtasks,
            "descendant_count": len(descendants),
        },
        "attention": {
            "score": effective_score,
            "reasons": reason_pool[:8],
            "suggested_action": (target.suggested_action if target else None) or "Проверьте блокеры и уточните следующий шаг.",
        },
        "transitions": [
            {
                "from_status": tr.from_status,
                "to_status": tr.to_status,
                "task_source_id": tr.task_source_id,
                "transitioned_at": tr.transitioned_at.isoformat(),
            }
            for tr in transition_slice
        ],
        "related_tasks": [
            {
                "source_task_id": tid,
                "title": task_by_id[tid].title if tid in task_by_id else tid,
                "current_status": task_by_id[tid].current_status if tid in task_by_id else None,
                "attention_score": attention_by_id[tid].attention_score if tid in attention_by_id else 0,
            }
            for tid in scoped_task_ids
        ][:50],
        "metrics_excerpt": {
            "median_lead_time_hours": metrics.get("median_lead_time_hours"),
            "median_cycle_time_hours": metrics.get("median_cycle_time_hours"),
            "rework_rate": metrics.get("rework_rate"),
            "reopen_rate": metrics.get("reopen_rate"),
        },
    }
