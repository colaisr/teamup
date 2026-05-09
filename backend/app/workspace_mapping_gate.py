"""Require confirmed ClickUp workflow mapping before numeric analytics."""

from sqlalchemy.orm import Session

from fastapi import HTTPException, status

from app.models import ClickUpConnection, WorkflowMapping

MAPPING_BLOCKED_MESSAGE_RU = (
    "Аналитика временно недоступна: для всех подключений ClickUp в этом workspace "
    "нужно завершить настройку — сохраните маппинг статусов во вкладке "
    "«Интеграции» (каждая связь должна быть в состоянии «Готово» / ready)."
)

# Stable machine-readable code for API clients (see frontend `mappingBlocked` / `apiErrorCode`).
ANALYTICS_MAPPINGS_INCOMPLETE_CODE = "analytics_mappings_incomplete"


def analytics_mappings_incomplete_detail() -> dict[str, str]:
    return {"code": ANALYTICS_MAPPINGS_INCOMPLETE_CODE, "message": MAPPING_BLOCKED_MESSAGE_RU}


def workspace_clickup_integration_ready(db: Session, workspace_id: str) -> bool:
    """
    True when the workspace has at least one ClickUp connection and every connection is
    `setup_status == ready` with at least one active WorkflowMapping. Used by background jobs
    that should mirror the analytics readiness rule (without treating no-ClickUp workspaces as eligible).
    """
    connections = (
        db.query(ClickUpConnection)
        .filter(ClickUpConnection.workspace_id == workspace_id, ClickUpConnection.provider == "clickup")
        .all()
    )
    if not connections:
        return False
    for conn in connections:
        if (conn.setup_status or "").strip() != "ready":
            return False
        n_active = (
            db.query(WorkflowMapping)
            .filter(
                WorkflowMapping.workspace_id == workspace_id,
                WorkflowMapping.connection_id == conn.id,
                WorkflowMapping.is_active.is_(True),
            )
            .count()
        )
        if n_active < 1:
            return False
    return True


def raise_if_workspace_clickup_mappings_incomplete(db: Session, workspace_id: str) -> None:
    """
    Product rule:
    If the workspace has any ClickUp connection, every connection must be
    `setup_status == 'ready'` and have at least one active WorkflowMapping row.
    Workspaces without ClickUp integrations are unrestricted (personal / empty workspaces).
    """
    connections = (
        db.query(ClickUpConnection)
        .filter(ClickUpConnection.workspace_id == workspace_id, ClickUpConnection.provider == "clickup")
        .all()
    )
    if not connections:
        return

    if not workspace_clickup_integration_ready(db, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=analytics_mappings_incomplete_detail(),
        )
