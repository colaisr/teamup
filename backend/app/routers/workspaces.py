from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.config import settings
from app.emailer import send_email_or_log
from app.models import User, Workspace, WorkspaceInvite, WorkspaceMember, WorkspaceRole
from app.schemas import (
    InviteAcceptRequest,
    InviteRequest,
    MessageResponse,
    WorkspaceCreateRequest,
    WorkspaceInviteOut,
    WorkspaceMemberOut,
    WorkspaceMemberRoleUpdate,
    WorkspaceOut,
    WorkspaceSwitchOut,
    WorkspaceUpdateRequest,
)
from app.security import create_random_token
from app.services.workspaces import PERSONAL_SUFFIX, ensure_personal_workspace, is_personal_workspace, sync_last_active_workspace

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


def _membership(db: Session, workspace_id: str, user_id: str) -> WorkspaceMember | None:
    return (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id)
        .first()
    )


def _check_owner(member: WorkspaceMember):
    if member.role != WorkspaceRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner only")


def _invite_row_status(row: WorkspaceInvite) -> str:
    if row.accepted_at:
        return "accepted"
    if row.revoked_at:
        return "revoked"
    return "pending"


def _invite_out(row: WorkspaceInvite) -> WorkspaceInviteOut:
    return WorkspaceInviteOut(
        id=row.id,
        email=row.email,
        role=row.role.value,
        status=_invite_row_status(row),
        created_at=row.created_at,
        expires_at=row.expires_at,
        accepted_at=row.accepted_at,
        revoked_at=row.revoked_at,
    )


def _workspace_out(db: Session, w: Workspace, role: WorkspaceRole, user: User, is_current: bool) -> WorkspaceOut:
    return WorkspaceOut(
        id=w.id,
        name=w.name,
        created_by=w.created_by,
        created_at=w.created_at,
        role=role.value,
        is_personal=is_personal_workspace(w, user, role),
        is_current=is_current,
    )


@router.post("", response_model=WorkspaceOut)
def create_workspace(
    payload: WorkspaceCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    u = db.query(User).filter(User.id == current_user.id).first()
    ensure_personal_workspace(db, u)
    ws = Workspace(name=payload.name, created_by=u.id)
    db.add(ws)
    db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=u.id, role=WorkspaceRole.owner))
    u.last_active_workspace_id = ws.id
    db.commit()
    db.refresh(ws)
    return _workspace_out(db, ws, WorkspaceRole.owner, u, is_current=True)


@router.post("/{workspace_id}/switch", response_model=WorkspaceSwitchOut)
def switch_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    u = db.query(User).filter(User.id == current_user.id).first()
    member = _membership(db, workspace_id, u.id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    u.last_active_workspace_id = workspace_id
    db.commit()
    return WorkspaceSwitchOut(workspace_id=workspace_id)


@router.put("/{workspace_id}", response_model=WorkspaceOut)
def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    u = db.query(User).filter(User.id == current_user.id).first()
    member = _membership(db, workspace_id, u.id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    _check_owner(member)

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    name = payload.name.strip()
    if is_personal_workspace(ws, u, member.role) and not name.endswith(PERSONAL_SUFFIX):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Personal workspace name must end with '{PERSONAL_SUFFIX}'",
        )
    ws.name = name
    db.commit()
    db.refresh(ws)
    is_cur = u.last_active_workspace_id == workspace_id
    return _workspace_out(db, ws, member.role, u, is_current=is_cur)


@router.put("/{workspace_id}/members/{user_id}", response_model=WorkspaceMemberOut)
def update_member_role(
    workspace_id: str,
    user_id: str,
    payload: WorkspaceMemberRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actor = _membership(db, workspace_id, current_user.id)
    if not actor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    _check_owner(actor)

    target = _membership(db, workspace_id, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if target.role == WorkspaceRole.owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change owner role")

    try:
        new_role = WorkspaceRole(payload.role)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role") from exc
    if new_role == WorkspaceRole.owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    target.role = new_role
    db.commit()
    db.refresh(target)
    user_row = db.query(User).filter(User.id == user_id).first()
    if not user_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return WorkspaceMemberOut(
        user_id=user_id,
        email=user_row.email,
        full_name=user_row.full_name,
        role=target.role.value,
    )


@router.delete("/{workspace_id}/members/{user_id}", response_model=MessageResponse)
def remove_member(
    workspace_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actor = _membership(db, workspace_id, current_user.id)
    if not actor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    target = _membership(db, workspace_id, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if target.role == WorkspaceRole.owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove workspace owner",
        )

    if actor.user_id != user_id:
        _check_owner(actor)

    db.delete(target)
    db.commit()
    return MessageResponse(message="Участник исключён из пространства.")


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    u = db.query(User).filter(User.id == current_user.id).first()
    ensure_personal_workspace(db, u)
    sync_last_active_workspace(db, u)
    db.commit()
    db.refresh(u)

    rows = (
        db.query(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .filter(WorkspaceMember.user_id == u.id)
        .order_by(Workspace.created_at.asc())
        .all()
    )
    cur_id = u.last_active_workspace_id
    return [_workspace_out(db, w, role, u, is_current=w.id == cur_id) for w, role in rows]


@router.post("/{workspace_id}/invites", response_model=MessageResponse)
def create_invite(
    workspace_id: str,
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = _membership(db, workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    _check_owner(member)

    try:
        role = WorkspaceRole(payload.role)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role") from exc

    if role == WorkspaceRole.owner:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot invite as owner")

    email_lower = payload.email.lower()

    pending = (
        db.query(WorkspaceInvite)
        .filter(
            WorkspaceInvite.workspace_id == workspace_id,
            WorkspaceInvite.email == email_lower,
            WorkspaceInvite.accepted_at.is_(None),
            WorkspaceInvite.revoked_at.is_(None),
        )
        .first()
    )
    if pending:
        return MessageResponse(message="Приглашение уже ожидает ответа.")

    invitee = db.query(User).filter(User.email == email_lower).first()
    if invitee:
        if _membership(db, workspace_id, invitee.id):
            return MessageResponse(message="Пользователь уже участник этого пространства.")

        db.add(WorkspaceMember(workspace_id=workspace_id, user_id=invitee.id, role=role))
        audit = WorkspaceInvite(
            workspace_id=workspace_id,
            email=email_lower,
            role=role,
            token=create_random_token(),
            created_by=current_user.id,
            accepted_at=datetime.utcnow(),
        )
        db.add(audit)
        db.commit()
        notify_body = (
            f"Вы добавлены в рабочее пространство TeamUp пользователем {current_user.email}.\n"
            f"Роль: {role.value}.\nВойдите в приложение и при необходимости переключите пространство в меню."
        )
        sent = send_email_or_log(
            to_email=invitee.email,
            subject="TeamUp — вас добавили в рабочее пространство",
            body=notify_body,
        )
        if sent:
            return MessageResponse(message="Пользователь добавлен и уведомлён по почте.")
        if settings.app_env == "development":
            return MessageResponse(message="Пользователь добавлен в пространство (SMTP недоступен).")
        return MessageResponse(message="Пользователь добавлен.")

    token = create_random_token()
    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        email=email_lower,
        role=role,
        token=token,
        created_by=current_user.id,
    )
    db.add(invite)
    db.commit()

    invite_link = f"/accept-invite?token={token}"
    body = f"Вас пригласили в рабочее пространство TeamUp.\n\nСсылка: {invite_link}\n\nСрок действия: 7 дней."
    sent = send_email_or_log(
        to_email=invite.email,
        subject="Приглашение в TeamUp",
        body=body,
    )
    if sent:
        return MessageResponse(message="Приглашение отправлено.")
    if settings.app_env == "development":
        return MessageResponse(
            message=(
                "Приглашение создано, но письмо не отправлено (SMTP недоступен). "
                f"Ссылка для разработки: {invite_link}"
            )
        )
    return MessageResponse(message="Приглашение создано, но письмо не удалось отправить.")


@router.get("/{workspace_id}/invites", response_model=list[WorkspaceInviteOut])
def list_invites(
    workspace_id: str,
    pending_only: bool = Query(True, alias="pending_only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = _membership(db, workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    _check_owner(member)

    q = db.query(WorkspaceInvite).filter(WorkspaceInvite.workspace_id == workspace_id)
    if pending_only:
        q = q.filter(WorkspaceInvite.accepted_at.is_(None), WorkspaceInvite.revoked_at.is_(None))

    rows = q.order_by(WorkspaceInvite.created_at.desc()).all()
    return [_invite_out(row) for row in rows]


@router.post("/{workspace_id}/invites/{invite_id}/revoke", response_model=MessageResponse)
def revoke_invite(
    workspace_id: str,
    invite_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = _membership(db, workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    _check_owner(member)

    invite = (
        db.query(WorkspaceInvite)
        .filter(WorkspaceInvite.id == invite_id, WorkspaceInvite.workspace_id == workspace_id)
        .first()
    )
    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")
    if invite.accepted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already accepted")
    if invite.revoked_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already revoked")

    invite.revoked_at = datetime.utcnow()
    db.commit()
    return MessageResponse(message="Приглашение отменено.")


@router.post("/invites/accept", response_model=MessageResponse)
def accept_invite(
    payload: InviteAcceptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invite = db.query(WorkspaceInvite).filter(WorkspaceInvite.token == payload.token).first()
    if not invite or invite.revoked_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite")
    if invite.accepted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite already accepted")
    if invite.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite expired")
    if invite.email != current_user.email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite email mismatch")

    existing = _membership(db, invite.workspace_id, current_user.id)
    if not existing:
        db.add(WorkspaceMember(workspace_id=invite.workspace_id, user_id=current_user.id, role=invite.role))
    invite.accepted_at = datetime.utcnow()
    u = db.query(User).filter(User.id == current_user.id).first()
    if u.last_active_workspace_id is None:
        u.last_active_workspace_id = invite.workspace_id
    db.commit()
    return MessageResponse(message="Вы успешно присоединились к рабочему пространству.")


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberOut])
def list_members(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = _membership(db, workspace_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    rows = (
        db.query(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .filter(WorkspaceMember.workspace_id == workspace_id)
        .all()
    )
    return [
        WorkspaceMemberOut(
            user_id=member.user_id,
            email=user.email,
            full_name=user.full_name,
            role=member.role.value,
        )
        for member, user in rows
    ]
