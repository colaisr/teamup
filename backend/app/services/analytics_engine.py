from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import Task, TaskTransition, WorkflowMapping
from app.schemas import AttentionTaskOut

LEGACY_CONNECTION_KEY = "__legacy__"


def active_mapping_by_connection(db: Session, workspace_id: str) -> dict[str, dict[str, str]]:
    rows = db.query(WorkflowMapping).filter(
        WorkflowMapping.workspace_id == workspace_id,
        WorkflowMapping.is_active.is_(True),
    )
    out: dict[str, dict[str, str]] = {}
    for row in rows:
        key = row.connection_id or LEGACY_CONNECTION_KEY
        out.setdefault(key, {})[row.source_status] = row.normalized_status
    return out


def normalize_status(
    mapping_by_connection: dict[str, dict[str, str]],
    connection_id: str | None,
    raw_status: str | None,
) -> str | None:
    if raw_status is None:
        return None
    conn_key = connection_id or LEGACY_CONNECTION_KEY
    scoped = mapping_by_connection.get(conn_key, {})
    if raw_status in scoped:
        return scoped[raw_status]
    legacy = mapping_by_connection.get(LEGACY_CONNECTION_KEY, {})
    return legacy.get(raw_status, raw_status)


def _hours(delta: timedelta | None) -> float:
    if not delta:
        return 0.0
    return round(delta.total_seconds() / 3600, 2)


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    vals = sorted(values)
    n = len(vals)
    return round(vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2, 2)


def _group_transitions_by_task(transitions: list[TaskTransition]) -> dict[tuple[str, str], list[TaskTransition]]:
    by_task: dict[tuple[str, str], list[TaskTransition]] = defaultdict(list)
    for transition in transitions:
        by_task[(transition.connection_id or "", transition.task_source_id)].append(transition)
    for key in by_task:
        by_task[key] = sorted(by_task[key], key=lambda item: item.transitioned_at)
    return by_task


def compute_metrics_payload(db: Session, workspace_id: str) -> dict:
    mapping = active_mapping_by_connection(db, workspace_id)
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    transitions = db.query(TaskTransition).filter(TaskTransition.workspace_id == workspace_id).all()
    by_task = _group_transitions_by_task(transitions)

    cycle_values: list[float] = []
    lead_values: list[float] = []
    rework_count = 0
    reopen_count = 0
    status_hours: dict[str, float] = defaultdict(float)

    for task in tasks:
        task_key = (task.connection_id or "", task.source_task_id)
        history = by_task.get(task_key, [])
        first_active: datetime | None = None
        done_at = task.completed_at_source
        prev_transition: TaskTransition | None = None

        for transition in history:
            current_norm = normalize_status(mapping, task.connection_id, transition.to_status)
            if not first_active and current_norm == "In Progress":
                first_active = transition.transitioned_at
            if prev_transition:
                prev_norm = normalize_status(mapping, task.connection_id, prev_transition.to_status)
                span = transition.transitioned_at - prev_transition.transitioned_at
                status_hours[str(prev_norm)] += _hours(span)
                if prev_norm in {"QA", "Review", "Done"} and current_norm == "In Progress":
                    rework_count += 1
                if prev_norm == "Done" and current_norm != "Done":
                    reopen_count += 1
            prev_transition = transition

        if task.created_at_source and done_at:
            lead_values.append((done_at - task.created_at_source).total_seconds() / 3600)
        if first_active and done_at:
            cycle_values.append((done_at - first_active).total_seconds() / 3600)

    return {
        "workspace_id": workspace_id,
        "median_lead_time_hours": _median(lead_values),
        "median_cycle_time_hours": _median(cycle_values),
        "rework_rate": round(rework_count / max(len(tasks), 1), 4),
        "reopen_rate": round(reopen_count / max(len(tasks), 1), 4),
        "time_in_status_hours": dict(status_hours),
        "task_count": len(tasks),
    }


def compute_attention_rows(db: Session, workspace_id: str, *, limit: int | None = 20) -> list[AttentionTaskOut]:
    mapping = active_mapping_by_connection(db, workspace_id)
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    transitions = db.query(TaskTransition).filter(TaskTransition.workspace_id == workspace_id).all()
    by_task = _group_transitions_by_task(transitions)

    now = datetime.utcnow()
    out: list[AttentionTaskOut] = []
    for task in tasks:
        task_key = (task.connection_id or "", task.source_task_id)
        history = by_task.get(task_key, [])
        reasons: list[str] = []
        score = 0.0
        action = "Проверьте блокеры и уточните следующий шаг."

        if task.due_at_source and not task.completed_at_source and task.due_at_source < now:
            score += 0.15
            reasons.append("Задача просрочена")
            action = "Согласуйте новый срок или ускорьте выполнение."
        if task.updated_at_source and (now - task.updated_at_source).days >= 2 and not task.completed_at_source:
            score += 0.2
            reasons.append("Нет обновлений более 2 дней")

        loop_count = 0
        for idx in range(1, len(history)):
            prev = normalize_status(mapping, task.connection_id, history[idx - 1].to_status)
            cur = normalize_status(mapping, task.connection_id, history[idx].to_status)
            if prev in {"QA", "Review", "Done"} and cur == "In Progress":
                loop_count += 1
        if loop_count > 0:
            score += min(0.25, loop_count * 0.08)
            reasons.append(f"Возвраты в работу: {loop_count}")
            action = "Проведите быстрый разбор причин возвратов."

        normalized_current = normalize_status(mapping, task.connection_id, task.current_status)
        if normalized_current in {"QA", "Review"}:
            latest = history[-1].transitioned_at if history else task.updated_at_source
            if latest and (now - latest).days >= 2:
                score += 0.4
                reasons.append("Задержка в критическом статусе")
                action = "Разблокируйте узкое место в QA/Review."

        if score > 0:
            out.append(
                AttentionTaskOut(
                    source_task_id=task.source_task_id,
                    title=task.title,
                    current_status=task.current_status,
                    attention_score=round(score, 3),
                    reasons=reasons,
                    suggested_action=action,
                )
            )

    ranked = sorted(out, key=lambda item: item.attention_score, reverse=True)
    if limit is None:
        return ranked
    return ranked[:limit]
