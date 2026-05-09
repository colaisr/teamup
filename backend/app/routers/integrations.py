import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.clickup_client import ClickUpClient, clickup_status_field_label, parse_clickup_ts
from app.database import get_db
from app.deps import get_current_user
from app.models import ClickUpConnection, ClickUpRawEvent, Task, TaskTransition, User, WorkflowMapping
from app.schemas import (
    ClickUpConnectRequest,
    ClickUpConnectionListOut,
    ClickUpConnectionOut,
    ClickUpCredentialsSecretOut,
    ClickUpCredentialsUpdateRequest,
    ClickUpScopeRequest,
    ClickUpVerifyTokenRequest,
    ClickUpVerifyTokenResponse,
    MessageResponse,
    WorkflowMappingSaveRequest,
)
from app.security import decrypt_value, encrypt_value
from app.utils import get_workspace_membership, require_admin_or_owner

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

NORMALIZED_STATUSES = {"Not Started", "Ready", "In Progress", "Review", "QA", "Blocked", "Done", "Cancelled"}

_SYNC_HISTORY_DAYS = 90
_INCREMENTAL_OVERLAP = timedelta(minutes=15)
_SYNC_ERR_MAX_LEN = 4000


def _sync_detail_str(detail: object) -> str:
    if isinstance(detail, str):
        return detail
    return str(detail)


def _record_sync_failure(db: Session, connection_id: str, attempt_at: datetime, err: str) -> None:
    row = _get_connection_by_id(db, connection_id)
    if not row:
        return
    row.last_sync_attempt_at = attempt_at
    row.last_sync_error = (err or "")[:_SYNC_ERR_MAX_LEN]
    db.add(row)
    db.commit()


def _normalize_import_sync_mode(sync_mode: str) -> str:
    v = (sync_mode or "auto").strip().lower()
    if v not in ("auto", "full", "incremental"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sync_mode must be one of: auto, full, incremental",
        )
    return v


def _import_time_window(sync_mode_norm: str, conn: ClickUpConnection) -> tuple[int | None, int | None, str]:
    """Returns (date_created_gt_ms, date_updated_gt_ms, label for response)."""
    full_created_cutoff = datetime.utcnow() - timedelta(days=_SYNC_HISTORY_DAYS)
    full_created_ms = int(full_created_cutoff.timestamp() * 1000)

    if sync_mode_norm == "full":
        return full_created_ms, None, "full"

    last = conn.last_synced_at

    if sync_mode_norm == "incremental":
        if last is None:
            return full_created_ms, None, "full_fallback"
        window_start = last - _INCREMENTAL_OVERLAP
        return None, int(window_start.timestamp() * 1000), "incremental"

    # auto
    if last is not None:
        window_start = last - _INCREMENTAL_OVERLAP
        return None, int(window_start.timestamp() * 1000), "incremental"
    return full_created_ms, None, "full"


def _task_type_snapshot_from_clickup(task_payload: dict) -> str | None:
    """First custom field value; can be large JSON from ClickUp → store as text."""
    fields = task_payload.get("custom_fields")
    if not fields or not isinstance(fields, list):
        return None
    first = fields[0]
    if not isinstance(first, dict):
        return None
    v = first.get("value")
    if v is None:
        return None
    if isinstance(v, (dict, list)):
        try:
            return json.dumps(v, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(v)
    return str(v)


def _label_from_clickup_me(me: dict) -> str | None:
    user_block = me.get("user") if isinstance(me.get("user"), dict) else {}
    email = user_block.get("email") if isinstance(user_block, dict) else None
    username = user_block.get("username") if isinstance(user_block, dict) else None
    return email or username


def _get_connection_by_id(db: Session, connection_id: str) -> ClickUpConnection | None:
    return db.query(ClickUpConnection).filter(ClickUpConnection.id == connection_id).first()


def _latest_workspace_connection(db: Session, workspace_id: str) -> ClickUpConnection | None:
    return (
        db.query(ClickUpConnection)
        .filter(ClickUpConnection.workspace_id == workspace_id)
        .order_by(ClickUpConnection.updated_at.desc())
        .first()
    )


def _serialize_connection(conn: ClickUpConnection) -> ClickUpConnectionOut:
    return ClickUpConnectionOut(
        id=conn.id,
        workspace_id=conn.workspace_id,
        provider=conn.provider or "clickup",
        name=conn.name or "ClickUp",
        clickup_user_label=conn.clickup_user_label,
        setup_status=conn.setup_status or "draft",
        scope_type=conn.selected_scope_type,
        scope_id=conn.selected_scope_id,
        scope_name=conn.selected_scope_name,
        clickup_team_id=conn.clickup_team_id,
        last_synced_at=conn.last_synced_at,
        last_sync_attempt_at=conn.last_sync_attempt_at,
        last_sync_error=conn.last_sync_error,
        created_at=conn.created_at,
        updated_at=conn.updated_at,
    )


def _get_connection_for_admin(
    db: Session,
    connection_id: str,
    current_user: User,
) -> ClickUpConnection:
    conn = _get_connection_by_id(db, connection_id)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
    member = get_workspace_membership(db, conn.workspace_id, current_user.id)
    require_admin_or_owner(member)
    return conn


def _get_connection_for_member(db: Session, connection_id: str, current_user: User) -> ClickUpConnection:
    conn = _get_connection_by_id(db, connection_id)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
    get_workspace_membership(db, conn.workspace_id, current_user.id)
    return conn


def _save_scope_on_connection(conn: ClickUpConnection, payload: ClickUpScopeRequest) -> None:
    conn.selected_scope_type = payload.scope_type
    conn.selected_scope_id = payload.scope_id
    conn.selected_scope_name = payload.scope_name
    conn.clickup_team_id = (payload.clickup_team_id or "").strip() or None if payload.scope_type == "space" else None
    conn.setup_status = "scope_selected"


def _import_connection(db: Session, conn: ClickUpConnection, *, sync_mode_norm: str) -> tuple[int, int, str]:
    if not conn.selected_scope_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scope is not configured")

    created_ms, updated_ms, used_label = _import_time_window(sync_mode_norm, conn)

    token = decrypt_value(conn.api_token_encrypted)
    client = ClickUpClient(token)
    scope_kind = conn.selected_scope_type or "list"

    if scope_kind == "space":
        if not conn.clickup_team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ClickUp team id is missing for space scope — re-save scope.",
            )
        tasks = client.get_tasks_from_team_space(
            conn.clickup_team_id, conn.selected_scope_id, created_ms, updated_ms
        )
    else:
        tasks = client.get_tasks_from_list(conn.selected_scope_id, created_ms, updated_ms)

    imported = 0
    transitions = 0
    now = datetime.utcnow()
    for task_payload in tasks:
        source_id = task_payload.get("id")
        if not source_id:
            continue
        source_id = str(source_id)
        task = (
            db.query(Task)
            .filter(
                Task.workspace_id == conn.workspace_id,
                Task.connection_id == conn.id,
                Task.source_task_id == source_id,
            )
            .first()
        )
        if not task:
            task = Task(
                workspace_id=conn.workspace_id,
                connection_id=conn.id,
                source_task_id=source_id,
                title=task_payload.get("name", ""),
            )
            db.add(task)
        task.title = task_payload.get("name", "")
        task.parent_source_task_id = str(task_payload.get("parent")) if task_payload.get("parent") else None
        task.current_status = clickup_status_field_label(task_payload.get("status"))
        task.task_type = _task_type_snapshot_from_clickup(task_payload)
        task.assignee_email = (task_payload.get("assignees") or [{}])[0].get("email") if task_payload.get("assignees") else None
        task.created_at_source = parse_clickup_ts(task_payload.get("date_created"))
        task.updated_at_source = parse_clickup_ts(task_payload.get("date_updated"))
        task.completed_at_source = parse_clickup_ts(task_payload.get("date_closed"))
        task.due_at_source = parse_clickup_ts(task_payload.get("due_date"))
        task.last_synced_at = now
        imported += 1

        history = task_payload.get("status_history") or []
        for item in history:
            if not isinstance(item, dict):
                continue
            at = parse_clickup_ts(item.get("date"))
            to_status = clickup_status_field_label(item.get("status"))
            if not at or not to_status:
                continue
            exists = (
                db.query(TaskTransition)
                .filter(
                    TaskTransition.workspace_id == conn.workspace_id,
                    TaskTransition.connection_id == conn.id,
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
                    workspace_id=conn.workspace_id,
                    connection_id=conn.id,
                    task_source_id=source_id,
                    from_status=None,
                    to_status=to_status,
                    transitioned_at=at,
                )
            )
            transitions += 1

    conn.last_sync_attempt_at = now
    conn.last_sync_error = None
    conn.last_synced_at = now
    db.add(
        ClickUpRawEvent(
            workspace_id=conn.workspace_id,
            connection_id=conn.id,
            event_type="clickup.import",
            payload=json.dumps(
                {"tasks": imported, "transitions": transitions, "sync_mode": used_label}
            ),
        )
    )
    return imported, transitions, used_label


@router.post("/clickup/verify-token", response_model=ClickUpVerifyTokenResponse)
def verify_clickup_token(payload: ClickUpVerifyTokenRequest, _user: User = Depends(get_current_user)):
    try:
        me = ClickUpClient(payload.api_token).verify()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"ClickUp auth failed: {exc}") from exc
    return ClickUpVerifyTokenResponse(ok=True, clickup_email=_label_from_clickup_me(me))


@router.get("/clickup/connections/{workspace_id}", response_model=ClickUpConnectionListOut)
def list_connections(workspace_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_workspace_membership(db, workspace_id, current_user.id)
    rows = (
        db.query(ClickUpConnection)
        .filter(ClickUpConnection.workspace_id == workspace_id, ClickUpConnection.provider == "clickup")
        .order_by(ClickUpConnection.updated_at.desc())
        .all()
    )
    return ClickUpConnectionListOut(workspace_id=workspace_id, connections=[_serialize_connection(r) for r in rows])


@router.post("/clickup/connections", response_model=ClickUpConnectionOut)
def create_connection(
    payload: ClickUpConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = get_workspace_membership(db, payload.workspace_id, current_user.id)
    require_admin_or_owner(member)
    try:
        me = ClickUpClient(payload.api_token).verify()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"ClickUp auth failed: {exc}") from exc

    label = _label_from_clickup_me(me)
    encrypted = encrypt_value(payload.api_token)
    now = datetime.utcnow()
    default_name = f"ClickUp {now.strftime('%Y-%m-%d %H:%M')}"
    conn = ClickUpConnection(
        workspace_id=payload.workspace_id,
        provider="clickup",
        name=(payload.name or "").strip() or default_name,
        clickup_user_label=label,
        setup_status="token_saved",
        api_token_encrypted=encrypted,
    )
    db.add(conn)
    db.flush()
    db.add(
        ClickUpRawEvent(
            workspace_id=payload.workspace_id,
            connection_id=conn.id,
            event_type="clickup.connect",
            payload=json.dumps({"user": label}),
        )
    )
    db.commit()
    db.refresh(conn)
    return _serialize_connection(conn)


@router.get("/clickup/connections/{connection_id}/credentials", response_model=ClickUpCredentialsSecretOut)
def get_connection_credentials(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = _get_connection_for_admin(db, connection_id, current_user)
    enc = (conn.api_token_encrypted or "").strip()
    if not enc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ClickUp token stored for this connection")
    try:
        raw = decrypt_value(enc)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not decrypt stored token",
        ) from exc
    if not (raw or "").strip():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ClickUp token stored for this connection")
    return ClickUpCredentialsSecretOut(api_token=raw)


@router.put("/clickup/connections/{connection_id}/credentials", response_model=ClickUpConnectionOut)
def update_connection_credentials(
    connection_id: str,
    payload: ClickUpCredentialsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = _get_connection_for_admin(db, connection_id, current_user)
    try:
        me = ClickUpClient(payload.api_token).verify()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"ClickUp auth failed: {exc}") from exc

    conn.api_token_encrypted = encrypt_value(payload.api_token)
    if payload.name is not None and payload.name.strip():
        conn.name = payload.name.strip()
    conn.clickup_user_label = _label_from_clickup_me(me)
    conn.setup_status = "token_saved"
    db.add(
        ClickUpRawEvent(
            workspace_id=conn.workspace_id,
            connection_id=conn.id,
            event_type="clickup.credentials_updated",
            payload=json.dumps({"user": conn.clickup_user_label}),
        )
    )
    db.commit()
    db.refresh(conn)
    return _serialize_connection(conn)


@router.post("/clickup/connections/{connection_id}/scope", response_model=ClickUpConnectionOut)
def save_connection_scope(
    connection_id: str,
    payload: ClickUpScopeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.connection_id and payload.connection_id != connection_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="connection_id mismatch")
    conn = _get_connection_for_admin(db, connection_id, current_user)
    _save_scope_on_connection(conn, payload)
    db.commit()
    db.refresh(conn)
    return _serialize_connection(conn)


@router.get("/clickup/connections/{connection_id}/scopes")
def list_connection_scopes(
    connection_id: str,
    team_id: str | None = None,
    folder_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = _get_connection_for_member(db, connection_id, current_user)
    token = decrypt_value(conn.api_token_encrypted)
    client = ClickUpClient(token)
    teams = client.get_teams()
    spaces = client.get_spaces(team_id) if team_id else []
    lists = client.get_lists(folder_id) if folder_id else []
    return {"connection_id": conn.id, "teams": teams, "spaces": spaces, "lists": lists}


@router.get("/clickup/connections/{connection_id}/statuses")
def list_connection_statuses(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = _get_connection_for_member(db, connection_id, current_user)
    if not conn.selected_scope_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scope is not configured")
    token = decrypt_value(conn.api_token_encrypted)
    client = ClickUpClient(token)
    scope_kind = conn.selected_scope_type or "list"
    if scope_kind == "space":
        if not conn.clickup_team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ClickUp team id is missing for space scope — re-save scope.",
            )
        statuses = client.union_status_strings_for_space(conn.selected_scope_id)
    else:
        info = client.get_list(conn.selected_scope_id)
        statuses = client.list_status_strings_for_list_payload(info)
    return {
        "workspace_id": conn.workspace_id,
        "connection_id": conn.id,
        "scope_type": scope_kind,
        "scope_id": conn.selected_scope_id,
        "statuses": statuses,
    }


@router.post("/clickup/connections/{connection_id}/mapping", response_model=MessageResponse)
def save_connection_mapping(
    connection_id: str,
    payload: WorkflowMappingSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.connection_id and payload.connection_id != connection_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="connection_id mismatch")
    conn = _get_connection_for_admin(db, connection_id, current_user)
    if not conn.selected_scope_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Scope is not configured")
    conn_scope = conn.selected_scope_type or "list"
    if conn_scope != payload.scope_type or conn.selected_scope_id != payload.scope_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mapping scope_type/scope_id does not match the connected ClickUp scope.",
        )

    invalid = [m.normalized_status for m in payload.mappings if m.normalized_status not in NORMALIZED_STATUSES]
    if invalid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid normalized statuses: {invalid}")

    current_version = (
        db.query(func.max(WorkflowMapping.version))
        .filter(WorkflowMapping.workspace_id == conn.workspace_id, WorkflowMapping.connection_id == conn.id)
        .scalar()
        or 0
    )
    new_version = int(current_version) + 1
    (
        db.query(WorkflowMapping)
        .filter(WorkflowMapping.workspace_id == conn.workspace_id, WorkflowMapping.connection_id == conn.id)
        .update({"is_active": False}, synchronize_session=False)
    )
    for item in payload.mappings:
        db.add(
            WorkflowMapping(
                workspace_id=conn.workspace_id,
                connection_id=conn.id,
                source_status=item.source_status,
                normalized_status=item.normalized_status,
                scope_type=payload.scope_type,
                scope_id=payload.scope_id,
                version=new_version,
                is_active=True,
            )
        )
    conn.setup_status = "ready"
    db.commit()
    return MessageResponse(message=f"Маппинг сохранен. Версия: {new_version}")


@router.get("/clickup/connections/{connection_id}/mapping")
def get_connection_mapping(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = _get_connection_for_member(db, connection_id, current_user)
    rows = (
        db.query(WorkflowMapping)
        .filter(
            WorkflowMapping.workspace_id == conn.workspace_id,
            WorkflowMapping.connection_id == conn.id,
            WorkflowMapping.is_active.is_(True),
        )
        .order_by(WorkflowMapping.source_status.asc())
        .all()
    )
    return {
        "workspace_id": conn.workspace_id,
        "connection_id": conn.id,
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


@router.post("/clickup/connections/{connection_id}/import", response_model=MessageResponse)
def import_connection_tasks(
    connection_id: str,
    sync_mode: str = Query("auto", description="auto | full | incremental"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = _get_connection_for_admin(db, connection_id, current_user)
    mode_norm = _normalize_import_sync_mode(sync_mode)
    attempt_at = datetime.utcnow()
    try:
        imported, transitions, used_label = _import_connection(db, conn, sync_mode_norm=mode_norm)
    except HTTPException as he:
        db.rollback()
        _record_sync_failure(db, conn.id, attempt_at, _sync_detail_str(he.detail))
        raise
    except Exception as exc:
        db.rollback()
        _record_sync_failure(db, conn.id, attempt_at, str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Импорт не удался (ClickUp или данные задачи): {exc}",
        ) from exc
    db.commit()
    return MessageResponse(
        message=f"Импорт завершен ({used_label}): задач={imported}, переходов={transitions}"
    )


@router.delete("/clickup/connections/{connection_id}", response_model=MessageResponse)
def delete_connection(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = _get_connection_for_admin(db, connection_id, current_user)
    db.query(TaskTransition).filter(TaskTransition.connection_id == conn.id).delete(synchronize_session=False)
    db.query(Task).filter(Task.connection_id == conn.id).delete(synchronize_session=False)
    db.query(WorkflowMapping).filter(WorkflowMapping.connection_id == conn.id).delete(synchronize_session=False)
    db.query(ClickUpRawEvent).filter(ClickUpRawEvent.connection_id == conn.id).delete(synchronize_session=False)
    db.delete(conn)
    db.commit()
    return MessageResponse(message="Интеграция ClickUp отключена.")


# Compatibility endpoints (workspace-addressed legacy paths)
@router.post("/clickup/connect", response_model=MessageResponse)
def connect_clickup_legacy(
    payload: ClickUpConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    create_connection(payload, db, current_user)
    return MessageResponse(message="Интеграция ClickUp подключена.")


@router.post("/clickup/scope", response_model=MessageResponse)
def set_scope_legacy(
    payload: ClickUpScopeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.connection_id:
        conn = _get_connection_for_admin(db, payload.connection_id, current_user)
    else:
        if not payload.workspace_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="workspace_id is required")
        member = get_workspace_membership(db, payload.workspace_id, current_user.id)
        require_admin_or_owner(member)
        conn = _latest_workspace_connection(db, payload.workspace_id)
        if not conn:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
    _save_scope_on_connection(conn, payload)
    db.commit()
    return MessageResponse(message="Область анализа сохранена.")


@router.get("/clickup/state/{workspace_id}")
def clickup_integration_state_legacy(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    conn = _latest_workspace_connection(db, workspace_id)
    if not conn:
        return {"connected": False}
    return {
        "connected": True,
        "scope_type": conn.selected_scope_type,
        "scope_id": conn.selected_scope_id,
        "scope_name": conn.selected_scope_name,
        "clickup_team_id": conn.clickup_team_id,
        "connection_id": conn.id,
        "setup_status": conn.setup_status,
    }


@router.get("/clickup/scopes/{workspace_id}")
def list_scopes_legacy(
    workspace_id: str,
    team_id: str | None = None,
    folder_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    conn = _latest_workspace_connection(db, workspace_id)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
    return list_connection_scopes(conn.id, team_id, folder_id, db, current_user)


@router.get("/clickup/statuses/{workspace_id}")
def get_scope_statuses_legacy(workspace_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    get_workspace_membership(db, workspace_id, current_user.id)
    conn = _latest_workspace_connection(db, workspace_id)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
    return list_connection_statuses(conn.id, db, current_user)


@router.post("/clickup/import/{workspace_id}", response_model=MessageResponse)
def import_clickup_tasks_legacy(
    workspace_id: str,
    sync_mode: str = Query("auto", description="auto | full | incremental"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = get_workspace_membership(db, workspace_id, current_user.id)
    require_admin_or_owner(member)
    conn = _latest_workspace_connection(db, workspace_id)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
    mode_norm = _normalize_import_sync_mode(sync_mode)
    attempt_at = datetime.utcnow()
    try:
        imported, transitions, used_label = _import_connection(db, conn, sync_mode_norm=mode_norm)
    except HTTPException as he:
        db.rollback()
        _record_sync_failure(db, conn.id, attempt_at, _sync_detail_str(he.detail))
        raise
    except Exception as exc:
        db.rollback()
        _record_sync_failure(db, conn.id, attempt_at, str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Импорт не удался (ClickUp или данные задачи): {exc}",
        ) from exc
    db.commit()
    return MessageResponse(
        message=f"Импорт завершен ({used_label}): задач={imported}, переходов={transitions}"
    )


@router.delete("/clickup/connection/{workspace_id}", response_model=MessageResponse)
def delete_clickup_connection_legacy(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = get_workspace_membership(db, workspace_id, current_user.id)
    require_admin_or_owner(member)
    conn = _latest_workspace_connection(db, workspace_id)
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
    return delete_connection(conn.id, db, current_user)


@router.post("/workflow-mapping", response_model=MessageResponse)
def save_workflow_mapping_legacy(
    payload: WorkflowMappingSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    connection_id = payload.connection_id
    if not connection_id:
        if not payload.workspace_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="workspace_id is required")
        get_workspace_membership(db, payload.workspace_id, current_user.id)
        conn = _latest_workspace_connection(db, payload.workspace_id)
        if not conn:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ClickUp connection not found")
        connection_id = conn.id
    return save_connection_mapping(connection_id, payload, db, current_user)


@router.get("/workflow-mapping/{workspace_id}")
def get_active_mapping_legacy(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    conn = _latest_workspace_connection(db, workspace_id)
    if not conn:
        return {"workspace_id": workspace_id, "mappings": []}
    return get_connection_mapping(conn.id, db, current_user)

