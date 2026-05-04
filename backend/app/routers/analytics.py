from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import InterventionLog, MetricSnapshot, Task, TaskTransition, User, WorkflowMapping
from app.schemas import AttentionTaskOut, InterventionLogCreate, MessageResponse
from app.utils import get_workspace_membership

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _active_mapping(db: Session, workspace_id: str) -> dict[str, str]:
    rows = db.query(WorkflowMapping).filter(
        WorkflowMapping.workspace_id == workspace_id, WorkflowMapping.is_active.is_(True)
    )
    return {r.source_status: r.normalized_status for r in rows}


def _hours(delta: timedelta | None) -> float:
    if not delta:
        return 0.0
    return round(delta.total_seconds() / 3600, 2)


@router.get("/metrics/{workspace_id}")
def compute_metrics(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    mapping = _active_mapping(db, workspace_id)
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    transitions = db.query(TaskTransition).filter(TaskTransition.workspace_id == workspace_id).all()

    by_task: dict[str, list[TaskTransition]] = defaultdict(list)
    for t in transitions:
        by_task[t.task_source_id].append(t)
    for k in by_task:
        by_task[k] = sorted(by_task[k], key=lambda x: x.transitioned_at)

    cycle_values: list[float] = []
    lead_values: list[float] = []
    rework_count = 0
    reopen_count = 0
    status_hours: dict[str, float] = defaultdict(float)

    for task in tasks:
        history = by_task.get(task.source_task_id, [])
        first_active = None
        done_at = task.completed_at_source
        prev = None
        for tr in history:
            norm = mapping.get(tr.to_status, tr.to_status)
            if not first_active and norm == "In Progress":
                first_active = tr.transitioned_at
            if prev:
                prev_norm = mapping.get(prev.to_status, prev.to_status)
                span = tr.transitioned_at - prev.transitioned_at
                status_hours[prev_norm] += _hours(span)
                if prev_norm in {"QA", "Review", "Done"} and norm == "In Progress":
                    rework_count += 1
                if prev_norm == "Done" and norm != "Done":
                    reopen_count += 1
            prev = tr
        if task.created_at_source and done_at:
            lead_values.append((done_at - task.created_at_source).total_seconds() / 3600)
        if first_active and done_at:
            cycle_values.append((done_at - first_active).total_seconds() / 3600)

    def _median(nums: list[float]) -> float:
        if not nums:
            return 0.0
        vals = sorted(nums)
        n = len(vals)
        return round(vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2, 2)

    result = {
        "workspace_id": workspace_id,
        "median_lead_time_hours": _median(lead_values),
        "median_cycle_time_hours": _median(cycle_values),
        "rework_rate": round(rework_count / max(len(tasks), 1), 4),
        "reopen_rate": round(reopen_count / max(len(tasks), 1), 4),
        "time_in_status_hours": dict(status_hours),
        "task_count": len(tasks),
    }
    return result


@router.get("/attention/{workspace_id}", response_model=list[AttentionTaskOut])
def attention_tasks(
    workspace_id: str,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    mapping = _active_mapping(db, workspace_id)
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    transitions = db.query(TaskTransition).filter(TaskTransition.workspace_id == workspace_id).all()

    by_task: dict[str, list[TaskTransition]] = defaultdict(list)
    for tr in transitions:
        by_task[tr.task_source_id].append(tr)
    for key in by_task:
        by_task[key] = sorted(by_task[key], key=lambda t: t.transitioned_at)

    now = datetime.utcnow()
    out: list[AttentionTaskOut] = []
    for task in tasks:
        history = by_task.get(task.source_task_id, [])
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
        for i in range(1, len(history)):
            prev = mapping.get(history[i - 1].to_status, history[i - 1].to_status)
            cur = mapping.get(history[i].to_status, history[i].to_status)
            if prev in {"QA", "Review", "Done"} and cur == "In Progress":
                loop_count += 1
        if loop_count > 0:
            score += min(0.25, loop_count * 0.08)
            reasons.append(f"Возвраты в работу: {loop_count}")
            action = "Проведите быстрый разбор причин возвратов."
        if task.current_status and mapping.get(task.current_status, task.current_status) in {"QA", "Review"}:
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
    return sorted(out, key=lambda x: x.attention_score, reverse=True)[:limit]


@router.post("/impact/snapshot/{workspace_id}", response_model=MessageResponse)
def save_snapshot(
    workspace_id: str,
    snapshot_type: str = "current",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    metrics = compute_metrics(workspace_id=workspace_id, db=db, current_user=current_user)
    period_end = datetime.utcnow()
    period_start = period_end - timedelta(days=28)
    rows = [
        ("median_lead_time_hours", metrics["median_lead_time_hours"]),
        ("median_cycle_time_hours", metrics["median_cycle_time_hours"]),
        ("rework_rate", metrics["rework_rate"]),
        ("reopen_rate", metrics["reopen_rate"]),
    ]
    for name, value in rows:
        db.add(
            MetricSnapshot(
                workspace_id=workspace_id,
                snapshot_type=snapshot_type,
                period_start=period_start,
                period_end=period_end,
                metric_name=name,
                metric_value=str(value),
            )
        )
    db.commit()
    return MessageResponse(message=f"Снимок метрик сохранен: {snapshot_type}")


@router.get("/impact/{workspace_id}")
def impact_compare(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    baseline = db.query(MetricSnapshot).filter(
        MetricSnapshot.workspace_id == workspace_id, MetricSnapshot.snapshot_type == "baseline"
    )
    current = db.query(MetricSnapshot).filter(
        MetricSnapshot.workspace_id == workspace_id, MetricSnapshot.snapshot_type == "current"
    )
    base_map = {m.metric_name: float(m.metric_value) for m in baseline.all()}
    curr_map = {m.metric_name: float(m.metric_value) for m in current.all()}
    metrics = []
    for key, cur_v in curr_map.items():
        base_v = base_map.get(key, 0.0)
        delta = round(cur_v - base_v, 4)
        delta_pct = round((delta / base_v) * 100, 2) if base_v else None
        metrics.append(
            {
                "metric": key,
                "baseline": base_v,
                "current": cur_v,
                "delta": delta,
                "delta_pct": delta_pct,
            }
        )
    return {"workspace_id": workspace_id, "metrics": metrics}


@router.post("/interventions", response_model=MessageResponse)
def add_intervention(
    payload: InterventionLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, payload.workspace_id, current_user.id)
    db.add(
        InterventionLog(
            workspace_id=payload.workspace_id,
            user_id=current_user.id,
            action_type=payload.action_type,
            note=payload.note,
        )
    )
    db.commit()
    return MessageResponse(message="Интервенция сохранена.")


@router.get("/interventions/{workspace_id}")
def list_interventions(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    rows = (
        db.query(InterventionLog)
        .filter(InterventionLog.workspace_id == workspace_id)
        .order_by(InterventionLog.created_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "action_type": row.action_type,
            "note": row.note,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]

