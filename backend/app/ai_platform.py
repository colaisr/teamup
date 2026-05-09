"""Platform-wide AI settings (singleton row). Shared by `/api/admin/ai` and future OpenRouter callers."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models import PLATFORM_AI_ROW_ID, PlatformAiSettings
from app.security import decrypt_value, encrypt_value

logger = logging.getLogger(__name__)


def ensure_platform_ai_row(db: Session) -> PlatformAiSettings:
    row = db.query(PlatformAiSettings).filter(PlatformAiSettings.id == PLATFORM_AI_ROW_ID).first()
    if row:
        return row
    row = PlatformAiSettings(
        id=PLATFORM_AI_ROW_ID,
        api_key_encrypted=encrypt_value(""),
        selected_model_id="",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def plaintext_openrouter_api_key(row: PlatformAiSettings) -> str:
    raw = row.api_key_encrypted
    if not raw or str(raw).strip() == "":
        return ""
    try:
        return decrypt_value(raw)
    except Exception:
        logger.exception("Decrypt platform OpenRouter API key failed")
        raise


def get_platform_openrouter_config(db: Session) -> tuple[str, str] | None:
    """Returns `(api_key, model_id)` for server-side callers, or `None` if no usable key is configured."""
    row = db.query(PlatformAiSettings).filter(PlatformAiSettings.id == PLATFORM_AI_ROW_ID).first()
    if not row:
        return None
    try:
        key = plaintext_openrouter_api_key(row)
    except Exception:
        logger.exception("Could not read platform OpenRouter key — check ENCRYPTION_KEY alignment")
        return None
    if not key.strip():
        return None
    return (key, row.selected_model_id or "")
