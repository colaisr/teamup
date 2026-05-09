from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import AiOutput, AiRun, User


def _dump_json(value: Any) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        return json.dumps({"_raw": str(value)}, ensure_ascii=False)


def start_ai_run(
    db: Session,
    *,
    workspace_id: str | None,
    current_user: User | None,
    capability: str,
    model_id: str,
    prompt_version: str,
    input_payload: dict[str, Any],
) -> AiRun:
    run = AiRun(
        workspace_id=workspace_id,
        user_id=current_user.id if current_user else None,
        capability=capability,
        model_id=model_id,
        prompt_version=prompt_version,
        status="running",
        input_json=_dump_json(input_payload),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def finish_ai_run_success(
    db: Session,
    *,
    run: AiRun,
    started_at: datetime,
    usage: dict[str, Any] | None,
    summary: str,
    capability_output: dict[str, Any],
    evidence_refs: list[str],
    workspace_id: str | None,
    capability: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
) -> None:
    run.status = "completed"
    run.latency_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
    run.usage_json = _dump_json(usage or {})
    run.error = None
    db.add(run)
    db.add(
        AiOutput(
            run_id=run.id,
            workspace_id=workspace_id,
            capability=capability,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            output_json=_dump_json(capability_output),
            evidence_refs_json=_dump_json(evidence_refs),
        )
    )
    db.commit()


def finish_ai_run_error(db: Session, *, run: AiRun, started_at: datetime, message: str) -> None:
    run.status = "failed"
    run.latency_ms = int((datetime.utcnow() - started_at).total_seconds() * 1000)
    run.error = message[:2000]
    db.add(run)
    db.commit()
