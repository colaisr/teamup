from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import MetricSnapshot, WorkflowMapping
from app.services.analytics_engine import compute_metrics_payload

IMPACT_METRICS = (
    "median_lead_time_hours",
    "median_cycle_time_hours",
    "rework_rate",
    "reopen_rate",
    "task_count",
)


def latest_snapshot_values(db: Session, workspace_id: str, snapshot_type: str) -> dict[str, float]:
    rows = (
        db.query(MetricSnapshot)
        .filter(
            MetricSnapshot.workspace_id == workspace_id,
            MetricSnapshot.snapshot_type == snapshot_type,
        )
        .order_by(MetricSnapshot.created_at.asc())
        .all()
    )
    out: dict[str, float] = {}
    for row in rows:
        try:
            out[row.metric_name] = float(row.metric_value)
        except (TypeError, ValueError):
            continue
    return out


def has_snapshot(db: Session, workspace_id: str, snapshot_type: str) -> bool:
    return (
        db.query(MetricSnapshot)
        .filter(
            MetricSnapshot.workspace_id == workspace_id,
            MetricSnapshot.snapshot_type == snapshot_type,
        )
        .first()
        is not None
    )


def save_metrics_snapshot(db: Session, workspace_id: str, snapshot_type: str) -> int:
    metrics = compute_metrics_payload(db, workspace_id)
    period_end = datetime.utcnow()
    period_start = period_end - timedelta(days=28)
    saved = 0
    for name in IMPACT_METRICS:
        value = metrics.get(name, 0)
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
        saved += 1
    return saved


def ensure_baseline_snapshot(db: Session, workspace_id: str) -> bool:
    if has_snapshot(db, workspace_id, "baseline"):
        return False
    has_mapping = (
        db.query(WorkflowMapping)
        .filter(
            WorkflowMapping.workspace_id == workspace_id,
            WorkflowMapping.is_active.is_(True),
        )
        .first()
        is not None
    )
    if not has_mapping:
        return False
    save_metrics_snapshot(db, workspace_id, "baseline")
    return True
