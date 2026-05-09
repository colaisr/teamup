from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func
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

# Automated periodic snapshots (see impact_weekly_scheduler); distinct from manual "current".
SNAPSHOT_TYPE_WEEKLY = "weekly"


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


def list_impact_snapshot_history(
    db: Session,
    workspace_id: str,
    *,
    limit: int = 40,
    max_rows: int = 8000,
) -> list[dict[str, Any]]:
    """Return recent snapshot batches, newest first. Rows are grouped by type + period + created time (second)."""
    rows = (
        db.query(MetricSnapshot)
        .filter(MetricSnapshot.workspace_id == workspace_id)
        .order_by(MetricSnapshot.created_at.desc())
        .limit(max_rows)
        .all()
    )
    groups: dict[tuple[str, datetime, datetime, datetime], dict[str, float]] = {}
    period_meta: dict[tuple[str, datetime, datetime, datetime], tuple[datetime, datetime, datetime]] = {}
    for row in rows:
        raw_ca = row.created_at or datetime.utcnow()
        ca_bucket = raw_ca.replace(microsecond=0)
        key = (row.snapshot_type, row.period_start, row.period_end, ca_bucket)
        if key not in groups:
            groups[key] = {}
            period_meta[key] = (row.period_start, row.period_end, raw_ca)
        try:
            groups[key][row.metric_name] = float(row.metric_value)
        except (TypeError, ValueError):
            continue

    ordered = sorted(
        groups.keys(),
        key=lambda k: period_meta[k][2],
        reverse=True,
    )
    out: list[dict[str, Any]] = []
    for key in ordered[: min(limit, 200)]:
        st, ps, pe, _ = key
        _, _, created_at = period_meta[key]
        out.append(
            {
                "snapshot_type": st,
                "period_start": ps.isoformat() if ps else None,
                "period_end": pe.isoformat() if pe else None,
                "created_at": created_at.isoformat() if created_at else None,
                "metrics": groups[key],
            }
        )
    return out


def latest_snapshot_created_at(db: Session, workspace_id: str, snapshot_type: str) -> datetime | None:
    return (
        db.query(func.max(MetricSnapshot.created_at))
        .filter(
            MetricSnapshot.workspace_id == workspace_id,
            MetricSnapshot.snapshot_type == snapshot_type,
        )
        .scalar()
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
    db.flush()
    save_metrics_snapshot(db, workspace_id, "baseline")
    return True
