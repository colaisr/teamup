import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.clickup_client import ClickUpClient, parse_clickup_ts
from app.database import get_db
from app.deps import get_current_user
from app.models import (
    ClickUpConnection,
    ClickUpRawEvent,
    Task,
    TaskTransition,
    User,
    WorkflowMapping,
)
from app.schemas import (
    ClickUpConnectRequest,
    ClickUpScopeRequest,
    MessageResponse,
    WorkflowMappingSaveRequest,
)
from app.security import decrypt_value, encrypt_value
from app.utils import get_workspace_membership, require_admin_or_owner

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

NORMALIZED_STATUSES = {"Not Started", "Ready", "In Progress", "Review", "QA", "Blocked", "Done", "Cancelled"}


def _get_connection(db: Session, workspace_id: str) -> ClickUpConnection | None:
    return db.query(ClickUpConnection).filter(ClickUpConnection.workspace_id == workspace_id).first()


@router.post("/clickup/connect", response_model=MessageResponse)
def connect_clickup(
    payload: ClickUpConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = get_workspace_membership(db, payload.workspace_id, current_user.id)
    require_admin_or_owner(membership)

    try:
        client = ClickUpClient(payload.api_token)
        me = client.verify()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"ClickUp auth failed: {exc}") from exc

    encrypted = encrypt_value(payload.api_token)
    conn = _get_connection(db, payload.workspace_id)
    if conn:
        conn.api_token_encrypted = encrypted
    else:
        conn = ClickUpConnection(workspace_id=payload.workspace_id, api_token_encrypted=encrypted)
        db.add(conn)
    db.add(
        ClickUpRawEvent(
            workspace_id=payload.workspace_id,
            event_type="clickup.connect",
            payload=json.dumps({"user": me.get("user", {}).get("email")}),
        )
    )
    db.commit()
    return MessageResponse(message="Интеграция ClickUp подключена.")


@router.post("/clickup/scope", response_model=MessageResponse)
def set_scope(
    payload: ClickUpScopeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = get_workspace_membership(db, payload.workspace_id, current_user.id)
    require_admin_or_owner(membership)
    conn = _get_connection(db, payload.workspace_id)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")

    conn.selected_scope_type = payload.scope_type
    conn.selected_scope_id = payload.scope_id
    conn.selected_scope_name = payload.scope_name
    db.commit()
    return MessageResponse(message="Область анализа сохранена.")


@router.get("/clickup/scopes/{workspace_id}")
def list_scopes(
    workspace_id: str,
    team_id: str | None = None,
    folder_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    conn = _get_connection(db, workspace_id)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
    token = decrypt_value(conn.api_token_encrypted)
    client = ClickUpClient(token)

    teams = client.get_teams()
    spaces = client.get_spaces(team_id) if team_id else []
    lists = client.get_lists(folder_id) if folder_id else []
    return {"teams": teams, "spaces": spaces, "lists": lists}


@router.get("/clickup/statuses/{workspace_id}")
def get_scope_statuses(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    conn = _get_connection(db, workspace_id)
    if not conn or not conn.selected_scope_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scope is not configured")

    token = decrypt_value(conn.api_token_encrypted)
    client = ClickUpClient(token)
    info = client.get_list(conn.selected_scope_id)
    statuses = [s.get("status") for s in info.get("statuses", []) if s.get("status")]

    return {"workspace_id": workspace_id, "scope_id": conn.selected_scope_id, "statuses": statuses}


@router.post("/clickup/import/{workspace_id}", response_model=MessageResponse)
def import_clickup_tasks(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = get_workspace_membership(db, workspace_id, current_user.id)
    require_admin_or_owner(membership)
    conn = _get_connection(db, workspace_id)
    if not conn or not conn.selected_scope_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scope is not configured")

    token = decrypt_value(conn.api_token_encrypted)
    client = ClickUpClient(token)

    start = datetime.utcnow() - timedelta(days=90)
    tasks = client.get_tasks_from_list(conn.selected_scope_id, int(start.timestamp() * 1000))
    imported = 0
    transitions = 0

    for task_payload in tasks:
        source_id = task_payload.get("id")
        if not source_id:
            continue
        task = (
            db.query(Task)
            .filter(Task.workspace_id == workspace_id, Task.source_task_id == source_id)
            .first()
        )
        if not task:
            task = Task(workspace_id=workspace_id, source_task_id=source_id, title=task_payload.get("name", ""))
            db.add(task)
        task.title = task_payload.get("name", "")
        task.current_status = (task_payload.get("status") or {}).get("status")
        task.task_type = (task_payload.get("custom_fields") or [{}])[0].get("value") if task_payload.get("custom_fields") else None
        task.assignee_email = (task_payload.get("assignees") or [{}])[0].get("email") if task_payload.get("assignees") else None
        task.created_at_source = parse_clickup_ts(task_payload.get("date_created"))
        task.updated_at_source = parse_clickup_ts(task_payload.get("date_updated"))
        task.completed_at_source = parse_clickup_ts(task_payload.get("date_closed"))
        task.due_at_source = parse_clickup_ts(task_payload.get("due_date"))
        task.last_synced_at = datetime.utcnow()
        imported += 1

        history = task_payload.get("status_history") or []
        for item in history:
            at = parse_clickup_ts(item.get("date"))
            to_status = (item.get("status") or {}).get("status")
            if not at or not to_status:
                continue
            exists = (
                db.query(TaskTransition)
                .filter(
                    TaskTransition.workspace_id == workspace_id,
                    TaskTransition.task_source_id == source_id,
                    TaskTransition.to_status == to_status,
                    TaskTransition.transitioned_at == at,
                )
                .first()
            )
            if exists:
                continue
            db.add(
                TaskTransition(
                    workspace_id=workspace_id,
                    task_source_id=source_id,
                    from_status=None,
                    to_status=to_status,
                    transitioned_at=at,
                )
            )
            transitions += 1

    db.add(
        ClickUpRawEvent(
            workspace_id=workspace_id,
            event_type="clickup.import",
            payload=json.dumps({"tasks": imported, "transitions": transitions}),
        )
    )
    db.commit()
    return MessageResponse(message=f"Импорт завершен: задач={imported}, переходов={transitions}")


@router.post("/workflow-mapping", response_model=MessageResponse)
def save_workflow_mapping(
    payload: WorkflowMappingSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = get_workspace_membership(db, payload.workspace_id, current_user.id)
    require_admin_or_owner(membership)
    conn = _get_connection(db, payload.workspace_id)
    if not conn or not conn.selected_scope_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scope is not configured")

    invalid = [m.normalized_status for m in payload.mappings if m.normalized_status not in NORMALIZED_STATUSES]
    if invalid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid normalized statuses: {invalid}")

    current_version = (
        db.query(func.max(WorkflowMapping.version))
        .filter(
            WorkflowMapping.workspace_id == payload.workspace_id,
            WorkflowMapping.scope_id == payload.scope_id,
            WorkflowMapping.scope_type == payload.scope_type,
        )
        .scalar()
        or 0
    )
    new_version = int(current_version) + 1

    (
        db.query(WorkflowMapping)
        .filter(
            WorkflowMapping.workspace_id == payload.workspace_id,
            WorkflowMapping.scope_id == payload.scope_id,
            WorkflowMapping.scope_type == payload.scope_type,
            WorkflowMapping.is_active.is_(True),
        )
        .update({"is_active": False}, synchronize_session=False)
    )
    for item in payload.mappings:
        db.add(
            WorkflowMapping(
                workspace_id=payload.workspace_id,
                source_status=item.source_status,
                normalized_status=item.normalized_status,
                scope_type=payload.scope_type,
                scope_id=payload.scope_id,
                version=new_version,
                is_active=True,
            )
        )
    db.commit()
    return MessageResponse(message=f"Маппинг сохранен. Версия: {new_version}")


@router.get("/workflow-mapping/{workspace_id}")
def get_active_mapping(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    rows = (
        db.query(WorkflowMapping)
        .filter(WorkflowMapping.workspace_id == workspace_id, WorkflowMapping.is_active.is_(True))
        .order_by(WorkflowMapping.source_status.asc())
        .all()
    )
    return {
        "workspace_id": workspace_id,
        "mappings": [
            {
                "source_status": r.source_status,
                "normalized_status": r.normalized_status,
                "version": r.version,
                "scope_type": r.scope_type,
                "scope_id": r.scope_id,
            }
            for r in rows
        ],
    }

