from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import or_

from app.config import settings
from app.database import SessionLocal
from app.models import ClickUpConnection

logger = logging.getLogger(__name__)

_stop_event = threading.Event()
_thread: threading.Thread | None = None


def _sync_interval() -> timedelta:
    minutes = max(1, settings.clickup_sync_interval_minutes)
    return timedelta(minutes=minutes)


def _due_clickup_connections(db, now: datetime) -> list[ClickUpConnection]:
    due_before = now - _sync_interval()
    return (
        db.query(ClickUpConnection)
        .filter(
            ClickUpConnection.provider == "clickup",
            ClickUpConnection.selected_scope_id.isnot(None),
            ClickUpConnection.api_token_encrypted != "",
            or_(
                ClickUpConnection.last_sync_attempt_at.is_(None),
                ClickUpConnection.last_sync_attempt_at <= due_before,
            ),
        )
        .order_by(ClickUpConnection.last_sync_attempt_at.asc().nullsfirst())
        .all()
    )


def run_due_clickup_syncs_once() -> int:
    """Run one scheduler pass. Returns number of attempted connections."""
    # Imported lazily to keep router wiring unchanged while this scheduler remains lightweight.
    from app.routers.integrations import _import_connection, _record_sync_failure, _sync_detail_str

    attempted = 0
    db = SessionLocal()
    try:
        for conn in _due_clickup_connections(db, datetime.utcnow()):
            attempted += 1
            attempt_at = datetime.utcnow()
            try:
                _import_connection(db, conn, sync_mode_norm="auto")
                db.commit()
                logger.info("Scheduled ClickUp sync succeeded for connection %s", conn.id)
            except HTTPException as exc:
                db.rollback()
                _record_sync_failure(db, conn.id, attempt_at, _sync_detail_str(exc.detail))
                logger.warning("Scheduled ClickUp sync failed for connection %s: %s", conn.id, exc.detail)
            except Exception as exc:  # noqa: BLE001 - scheduler must record and continue per connection.
                db.rollback()
                _record_sync_failure(db, conn.id, attempt_at, str(exc))
                logger.warning("Scheduled ClickUp sync failed for connection %s: %s", conn.id, exc)
    finally:
        db.close()
    return attempted


def _scheduler_loop() -> None:
    initial_delay = max(0, settings.clickup_sync_initial_delay_seconds)
    if _stop_event.wait(initial_delay):
        return

    while not _stop_event.is_set():
        try:
            run_due_clickup_syncs_once()
        except Exception:
            logger.exception("Scheduled ClickUp sync pass failed unexpectedly")

        interval_seconds = max(60, int(_sync_interval().total_seconds()))
        _stop_event.wait(interval_seconds)


def start_clickup_sync_scheduler() -> None:
    global _thread

    if not settings.clickup_sync_scheduler_enabled:
        logger.info("ClickUp sync scheduler disabled")
        return
    if _thread and _thread.is_alive():
        return

    _stop_event.clear()
    _thread = threading.Thread(target=_scheduler_loop, name="clickup-sync-scheduler", daemon=True)
    _thread.start()
    logger.info(
        "ClickUp sync scheduler started: interval=%s minute(s), initial_delay=%s second(s)",
        settings.clickup_sync_interval_minutes,
        settings.clickup_sync_initial_delay_seconds,
    )


def stop_clickup_sync_scheduler() -> None:
    _stop_event.set()
    if _thread and _thread.is_alive():
        _thread.join(timeout=5)
