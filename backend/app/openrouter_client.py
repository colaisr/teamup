"""Thin OpenRouter REST client shared by AI settings and feature capabilities."""

from __future__ import annotations

from typing import Any

import requests

from app.config import settings


def _openrouter_v1_base() -> str:
    base = settings.openrouter_api_base.strip() or "https://openrouter.ai/api/v1"
    return base.rstrip("/")


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.openrouter_http_referer,
        "X-Title": settings.openrouter_app_title,
    }


def format_openrouter_http_error(resp: requests.Response) -> str:
    text = resp.text.strip()
    if not text:
        return f"OpenRouter HTTP {resp.status_code}"
    try:
        body: dict[str, Any] = resp.json()  # type: ignore[assignment]
    except ValueError:
        return text[:500]
    err = body.get("error")
    if isinstance(err, dict):
        msg = err.get("message")
        if isinstance(msg, str) and msg.strip():
            return msg.strip()
    raw_msg = body.get("message")
    if isinstance(raw_msg, str) and raw_msg.strip():
        return raw_msg.strip()
    return text[:500]


def list_models(api_key: str, *, timeout: float = 45) -> list[dict[str, str]]:
    """Fetch available models via GET /models. Raises requests.HTTPError on failure."""
    key = api_key.strip()
    if not key:
        raise ValueError("OpenRouter API key is empty")

    resp = requests.get(
        f"{_openrouter_v1_base()}/models",
        headers=_headers(key),
        timeout=timeout,
    )
    resp.raise_for_status()
    parsed: dict[str, Any] | list[Any] | None
    try:
        parsed = resp.json()
    except ValueError as exc:
        raise ValueError("Invalid JSON from OpenRouter /models") from exc

    if not isinstance(parsed, dict):
        return []

    rows = parsed.get("data") or parsed.get("models")
    if not isinstance(rows, list):
        return []

    out: list[dict[str, str]] = []
    for raw in rows:
        if not isinstance(raw, dict):
            continue
        mid = raw.get("id")
        if not isinstance(mid, str) or not mid.strip():
            continue
        name = raw.get("name")
        title = raw.get("title")
        display = ""
        if isinstance(name, str) and name.strip():
            display = name.strip()
        elif isinstance(title, str) and title.strip():
            display = title.strip()
        else:
            display = mid.strip()
        out.append({"id": mid.strip(), "name": display})

    out.sort(key=lambda x: x["id"].lower())
    return out


def ping(api_key: str, *, timeout: float = 20) -> None:
    """Verifies connectivity by hitting /models (same call as discovery)."""
    key = api_key.strip()
    if not key:
        raise ValueError("OpenRouter API key is empty")
    try:
        list_models(key, timeout=timeout)
    except requests.HTTPError as exc:
        if exc.response is not None:
            raise RuntimeError(format_openrouter_http_error(exc.response)) from exc
        raise RuntimeError("OpenRouter request failed") from exc


def resolve_model_id(explicit_model_id: str | None, default_model_id: str | None) -> str:
    """Resolve effective model id from request-level override + platform default."""
    explicit = (explicit_model_id or "").strip()
    if explicit:
        return explicit
    fallback = (default_model_id or "").strip()
    if fallback:
        return fallback
    raise ValueError("No OpenRouter model selected. Save a default model in system AI settings.")


def _extract_text_from_choice(choice_message: Any) -> str:
    if not isinstance(choice_message, dict):
        return ""
    content = choice_message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text = item.get("text")
            if isinstance(text, str) and text.strip():
                chunks.append(text)
        return "\n".join(chunks).strip()
    return ""


def chat_complete(
    *,
    api_key: str,
    model_id: str,
    messages: list[dict[str, str]],
    temperature: float = 0.2,
    max_tokens: int | None = None,
    timeout: float = 60,
) -> dict[str, Any]:
    key = api_key.strip()
    if not key:
        raise ValueError("OpenRouter API key is empty")
    model = model_id.strip()
    if not model:
        raise ValueError("OpenRouter model_id is empty")
    if not messages:
        raise ValueError("At least one message is required")

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if isinstance(max_tokens, int) and max_tokens > 0:
        payload["max_tokens"] = max_tokens

    resp = requests.post(
        f"{_openrouter_v1_base()}/chat/completions",
        headers=_headers(key),
        json=payload,
        timeout=timeout,
    )
    resp.raise_for_status()
    parsed: dict[str, Any]
    try:
        parsed = resp.json()  # type: ignore[assignment]
    except ValueError as exc:
        raise ValueError("Invalid JSON from OpenRouter /chat/completions") from exc

    choices = parsed.get("choices")
    first_choice = choices[0] if isinstance(choices, list) and choices else {}
    message = first_choice.get("message") if isinstance(first_choice, dict) else {}
    text = _extract_text_from_choice(message).strip()

    usage = parsed.get("usage") if isinstance(parsed.get("usage"), dict) else {}
    return {
        "id": parsed.get("id") or "",
        "model": parsed.get("model") or model,
        "text": text,
        "usage": usage,
        "raw": parsed,
    }
