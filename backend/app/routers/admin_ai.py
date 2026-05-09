import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.ai_platform import ensure_platform_ai_row, plaintext_openrouter_api_key
from app.database import get_db
from app.deps import get_current_platform_admin
from app.models import PlatformAiSettings, User
from app.openrouter_client import (
    format_openrouter_http_error,
    list_models,
    ping as openrouter_ping,
)
from app.schemas import (
    AiOptionalApiKey,
    AiPlatformSettingsOut,
    AiPlatformSettingsPut,
    AiTestConnectionResponse,
    OpenRouterModelBrief,
    OpenRouterModelsListResponse,
)
from app.security import encrypt_value

router = APIRouter(prefix="/api/admin/ai", tags=["admin-ai"])


def _plaintext_for_response(row: PlatformAiSettings) -> str:
    try:
        return plaintext_openrouter_api_key(row)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stored API key cannot be decrypted. Check encryption key rotation.",
        ) from exc


def _effective_key(body_key: str | None, row: PlatformAiSettings) -> str:
    trimmed = body_key.strip() if isinstance(body_key, str) else ""
    if trimmed:
        return trimmed
    return _plaintext_for_response(row)


@router.get("/settings", response_model=AiPlatformSettingsOut)
def get_ai_settings(db: Session = Depends(get_db), _: User = Depends(get_current_platform_admin)):
    row = ensure_platform_ai_row(db)
    return AiPlatformSettingsOut(
        api_key=_plaintext_for_response(row),
        model_id=row.selected_model_id or "",
        updated_at=row.updated_at,
    )


@router.put("/settings", response_model=AiPlatformSettingsOut)
def put_ai_settings(
    payload: AiPlatformSettingsPut,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_platform_admin),
):
    row = ensure_platform_ai_row(db)
    row.api_key_encrypted = encrypt_value(payload.api_key.strip() if payload.api_key else "")
    row.selected_model_id = payload.model_id.strip() if payload.model_id else ""
    db.add(row)
    db.commit()
    db.refresh(row)
    return AiPlatformSettingsOut(
        api_key=_plaintext_for_response(row),
        model_id=row.selected_model_id or "",
        updated_at=row.updated_at,
    )


@router.post("/models/list", response_model=OpenRouterModelsListResponse)
def post_models_list(
    payload: AiOptionalApiKey,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_platform_admin),
):
    row = ensure_platform_ai_row(db)
    api_key = _effective_key(payload.api_key, row)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key required: enter a key above or save one in settings.",
        )
    try:
        raw_models = list_models(api_key)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except requests.HTTPError as exc:
        if exc.response is not None:
            detail = format_openrouter_http_error(exc.response)
        else:
            detail = str(exc) or "OpenRouter request failed"
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
    return OpenRouterModelsListResponse(
        models=[OpenRouterModelBrief(id=m["id"], name=m.get("name", m["id"])) for m in raw_models]
    )


@router.post("/test-connection", response_model=AiTestConnectionResponse)
def post_test_connection(
    payload: AiOptionalApiKey,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_platform_admin),
):
    row = ensure_platform_ai_row(db)
    api_key = _effective_key(payload.api_key, row)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key required: enter a key above or save one in settings.",
        )
    try:
        openrouter_ping(api_key)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return AiTestConnectionResponse(ok=True, message="OpenRouter responded successfully.")
