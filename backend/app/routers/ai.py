from __future__ import annotations

from datetime import datetime

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.ai_platform import get_platform_openrouter_config
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.openrouter_client import format_openrouter_http_error, resolve_model_id
from app.schemas import AttentionExplainRequest, AttentionExplainResponse
from app.services.ai.audit import finish_ai_run_error, finish_ai_run_success, start_ai_run
from app.services.ai.capabilities import (
    CAPABILITY_ATTENTION_TASK_EXPLANATION,
    PROMPT_VERSION_ATTENTION_EXPLAIN,
    explain_attention_task_with_ai,
)
from app.services.ai.context_builders import build_attention_task_context
from app.utils import get_workspace_membership
from app.workspace_mapping_gate import raise_if_workspace_clickup_mappings_incomplete

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/attention/{workspace_id}/explain-task", response_model=AttentionExplainResponse)
def explain_attention_task(
    workspace_id: str,
    payload: AttentionExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    raise_if_workspace_clickup_mappings_incomplete(db, workspace_id)
    provider_config = get_platform_openrouter_config(db)
    if not provider_config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI provider is not configured. Add API key and model in /settings/system.",
        )

    api_key, default_model = provider_config
    try:
        model_id = resolve_model_id(payload.model_id, default_model)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        context = build_attention_task_context(
            db,
            workspace_id=workspace_id,
            source_task_id=payload.source_task_id,
            include_subtasks=payload.include_subtasks,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    evidence_refs = [
        f"task:{payload.source_task_id}",
        f"workspace:{workspace_id}",
        "signal:attention_score",
        "signal:attention_reasons",
        "signal:metrics_excerpt",
        "signal:subtasks_rollup" if payload.include_subtasks else "signal:single_task",
    ]
    run = start_ai_run(
        db,
        workspace_id=workspace_id,
        current_user=current_user,
        capability=CAPABILITY_ATTENTION_TASK_EXPLANATION,
        model_id=model_id,
        prompt_version=PROMPT_VERSION_ATTENTION_EXPLAIN,
        input_payload={
            "source_task_id": payload.source_task_id,
            "include_subtasks": payload.include_subtasks,
            "context": context,
        },
    )
    started_at = datetime.utcnow()
    try:
        output, usage = explain_attention_task_with_ai(
            api_key=api_key,
            model_id=model_id,
            context=context,
        )
        finish_ai_run_success(
            db,
            run=run,
            started_at=started_at,
            usage=usage,
            summary=output["summary"],
            capability_output=output,
            evidence_refs=evidence_refs,
            workspace_id=workspace_id,
            capability=CAPABILITY_ATTENTION_TASK_EXPLANATION,
            entity_type="task",
            entity_id=payload.source_task_id,
        )
    except requests.HTTPError as exc:
        detail = format_openrouter_http_error(exc.response) if exc.response is not None else "OpenRouter request failed"
        finish_ai_run_error(db, run=run, started_at=started_at, message=detail)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
    except Exception as exc:
        msg = str(exc) or "AI capability failed"
        finish_ai_run_error(db, run=run, started_at=started_at, message=msg)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=msg) from exc

    return AttentionExplainResponse(
        run_id=run.id,
        workspace_id=workspace_id,
        source_task_id=payload.source_task_id,
        model_id=model_id,
        summary=output["summary"],
        takeaways=output["takeaways"],
        recommended_actions=output["recommended_actions"],
        evidence_refs=evidence_refs,
        limitations=output["limitations"],
    )
