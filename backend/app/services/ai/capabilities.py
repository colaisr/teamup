from __future__ import annotations

import json
from typing import Any

from app.openrouter_client import chat_complete

CAPABILITY_ATTENTION_TASK_EXPLANATION = "attention_task_explanation"
PROMPT_VERSION_ATTENTION_EXPLAIN = "v1"


def _system_prompt() -> str:
    return (
        "Ты ассистент TeamUp для Engineering Manager. "
        "Используй только предоставленный контекст. "
        "Не выдумывай факты. "
        "Ответ верни строго в JSON с полями: summary, takeaways, recommended_actions, limitations."
    )


def _user_prompt(context: dict[str, Any]) -> str:
    return (
        "Контекст задачи внимания:\n"
        f"{json.dumps(context, ensure_ascii=False, indent=2)}\n\n"
        "Сформируй дружелюбное и деловое объяснение проблемы и что делать дальше. "
        "takeaways и recommended_actions верни массивами коротких строк."
    )


def _coerce_output(raw_text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw_text)
    except ValueError:
        parsed = {"summary": raw_text.strip()}
    if not isinstance(parsed, dict):
        parsed = {"summary": str(parsed)}

    summary = parsed.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        summary = "Требуется менеджерская проверка по сигналам Attention."

    takeaways = parsed.get("takeaways")
    if not isinstance(takeaways, list):
        takeaways = []
    takeaways = [str(x) for x in takeaways if str(x).strip()]

    recommended = parsed.get("recommended_actions")
    if not isinstance(recommended, list):
        recommended = []
    recommended = [str(x) for x in recommended if str(x).strip()]

    limitations = parsed.get("limitations")
    if not isinstance(limitations, str):
        limitations = ""

    return {
        "summary": summary.strip(),
        "takeaways": takeaways[:5],
        "recommended_actions": recommended[:5],
        "limitations": limitations.strip(),
    }


def explain_attention_task_with_ai(
    *,
    api_key: str,
    model_id: str,
    context: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    response = chat_complete(
        api_key=api_key,
        model_id=model_id,
        messages=[
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": _user_prompt(context)},
        ],
        temperature=0.2,
        max_tokens=600,
    )
    coerced = _coerce_output(response.get("text", ""))
    return coerced, response.get("usage", {})
