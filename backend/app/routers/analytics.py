from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import InterventionLog, MetricSnapshot, User
from app.schemas import AttentionTaskOut, InterventionLogCreate, MessageResponse
from app.services.analytics_engine import compute_attention_rows, compute_metrics_payload
from app.utils import get_workspace_membership
from app.workspace_mapping_gate import raise_if_workspace_clickup_mappings_incomplete

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/metrics/{workspace_id}")
def compute_metrics(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    raise_if_workspace_clickup_mappings_incomplete(db, workspace_id)
    return compute_metrics_payload(db, workspace_id)


@router.get("/attention/{workspace_id}", response_model=list[AttentionTaskOut])
def attention_tasks(
    workspace_id: str,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    raise_if_workspace_clickup_mappings_incomplete(db, workspace_id)
    return compute_attention_rows(db, workspace_id, limit=limit)


@router.post("/impact/snapshot/{workspace_id}", response_model=MessageResponse)
def save_snapshot(
    workspace_id: str,
    snapshot_type: str = "current",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    raise_if_workspace_clickup_mappings_incomplete(db, workspace_id)
    metrics = compute_metrics_payload(db, workspace_id)
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
    raise_if_workspace_clickup_mappings_incomplete(db, workspace_id)
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

