from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import InterventionLog, User
from app.schemas import AttentionTaskOut, InterventionLogCreate, MessageResponse
from app.services.analytics_engine import compute_attention_rows, compute_metrics_payload
from app.services.impact_snapshots import (
    latest_snapshot_values,
    list_impact_snapshot_history,
    save_metrics_snapshot,
)
from app.utils import get_workspace_membership
from app.workspace_mapping_gate import raise_if_workspace_clickup_mappings_incomplete

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

LOWER_IS_BETTER = {
    "median_lead_time_hours",
    "median_cycle_time_hours",
    "rework_rate",
    "reopen_rate",
}
NEUTRAL_METRICS = {"task_count"}


def _impact_direction(metric: str, delta: float) -> str:
    if abs(delta) < 0.0001:
        return "neutral"
    if metric in NEUTRAL_METRICS:
        return "neutral"
    if metric in LOWER_IS_BETTER:
        return "improved" if delta < 0 else "worsened"
    return "improved" if delta > 0 else "worsened"


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
    save_metrics_snapshot(db, workspace_id, snapshot_type)
    db.commit()
    return MessageResponse(message=f"Снимок метрик сохранен: {snapshot_type}")


@router.get("/impact/history/{workspace_id}")
def impact_snapshot_history(
    workspace_id: str,
    limit: int = 40,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    raise_if_workspace_clickup_mappings_incomplete(db, workspace_id)
    capped = max(1, min(limit, 200))
    return {
        "workspace_id": workspace_id,
        "snapshots": list_impact_snapshot_history(db, workspace_id, limit=capped),
    }


@router.get("/impact/{workspace_id}")
def impact_compare(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    raise_if_workspace_clickup_mappings_incomplete(db, workspace_id)
    base_map = latest_snapshot_values(db, workspace_id, "baseline")
    curr_map = compute_metrics_payload(db, workspace_id)
    metrics = []
    improved: list[str] = []
    worsened: list[str] = []
    for key, cur_v in curr_map.items():
        if key == "workspace_id" or isinstance(cur_v, dict):
            continue
        base_v = base_map.get(key, 0.0)
        cur_v = float(cur_v)
        delta = round(cur_v - base_v, 4)
        delta_pct = round((delta / base_v) * 100, 2) if base_v else None
        direction = _impact_direction(key, delta)
        if direction == "improved":
            improved.append(key)
        elif direction == "worsened":
            worsened.append(key)
        metrics.append(
            {
                "metric": key,
                "baseline": base_v,
                "current": cur_v,
                "delta": delta,
                "delta_pct": delta_pct,
                "direction": direction,
            }
        )
    return {
        "workspace_id": workspace_id,
        "has_baseline": bool(base_map),
        "metrics": metrics,
        "commentary": {
            "improved": improved,
            "worsened": worsened,
        },
    }


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

