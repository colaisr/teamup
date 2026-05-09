from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta

from app.config import settings
from app.database import SessionLocal
from app.models import ClickUpConnection
from app.services.impact_snapshots import SNAPSHOT_TYPE_WEEKLY, latest_snapshot_created_at, save_metrics_snapshot
from app.workspace_mapping_gate import workspace_clickup_integration_ready

logger = logging.getLogger(__name__)

_stop_event = threading.Event()
_thread: threading.Thread | None = None


def _tick_interval() -> timedelta:
    hours = max(1, settings.impact_weekly_snapshot_tick_interval_hours)
    return timedelta(hours=hours)


def _min_gap_between_weekly() -> timedelta:
    hours = max(1, settings.impact_weekly_snapshot_interval_hours)
    return timedelta(hours=hours)


def _eligible_workspace_ids(db) -> list[str]:
    workspace_ids = [
        wid
        for (wid,) in db.query(ClickUpConnection.workspace_id)
        .filter(ClickUpConnection.provider == "clickup")
        .distinct()
        .all()
        if wid
    ]
    return sorted({str(wid) for wid in workspace_ids if workspace_clickup_integration_ready(db, str(wid))})


def run_impact_weekly_snapshots_once() -> tuple[int, int]:
    """
    One scheduler pass: save SNAPSHOT_TYPE_WEEKLY snapshots for workspaces that are ClickUp-ready
    and have not received a weekly batch within configured interval.

    Returns (workspaces_checked, workspaces_saved).
    """
    listing = SessionLocal()
    try:
        workspace_ids = _eligible_workspace_ids(listing)
    finally:
        listing.close()

    checked = 0
    saved = 0
    now = datetime.utcnow()
    min_gap = _min_gap_between_weekly()

    for workspace_id in workspace_ids:
        checked += 1
        db_session = SessionLocal()
        try:
            last_at = latest_snapshot_created_at(db_session, workspace_id, SNAPSHOT_TYPE_WEEKLY)
            if last_at is not None:
                last_naive = last_at.replace(tzinfo=None) if last_at.tzinfo else last_at
                if now - last_naive < min_gap:
                    continue
            save_metrics_snapshot(db_session, workspace_id, SNAPSHOT_TYPE_WEEKLY)
            db_session.commit()
            saved += 1
            logger.info("Scheduled weekly impact snapshot saved for workspace %s", workspace_id)
        except Exception as exc:  # noqa: BLE001 — continue other workspaces
            db_session.rollback()
            logger.warning("Weekly impact snapshot failed for workspace %s: %s", workspace_id, exc)
        finally:
            db_session.close()
    return checked, saved


def _scheduler_loop() -> None:
    initial_delay = max(0, settings.impact_weekly_snapshot_scheduler_initial_delay_seconds)
    if _stop_event.wait(initial_delay):
        return

    while not _stop_event.is_set():
        try:
            run_impact_weekly_snapshots_once()
        except Exception:
            logger.exception("Impact weekly snapshot pass failed unexpectedly")

        interval_seconds = max(60, int(_tick_interval().total_seconds()))
        _stop_event.wait(interval_seconds)


def start_impact_weekly_snapshot_scheduler() -> None:
    global _thread

    if not settings.impact_weekly_snapshot_scheduler_enabled:
        logger.info("Impact weekly snapshot scheduler disabled")
        return
    if _thread and _thread.is_alive():
        return

    _stop_event.clear()
    _thread = threading.Thread(target=_scheduler_loop, name="impact-weekly-snapshots", daemon=True)
    _thread.start()
    logger.info(
        "Impact weekly snapshot scheduler started: interval_hours=%s tick_hours=%s initial_delay=%ss",
        settings.impact_weekly_snapshot_interval_hours,
        settings.impact_weekly_snapshot_tick_interval_hours,
        settings.impact_weekly_snapshot_scheduler_initial_delay_seconds,
    )


def stop_impact_weekly_snapshot_scheduler() -> None:
    _stop_event.set()
    if _thread and _thread.is_alive():
        _thread.join(timeout=5)
