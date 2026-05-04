from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
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
    WorkspaceOut,
)
from app.security import create_random_token
from app.services.workspaces import is_personal_workspace

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


def _membership(db: Session, workspace_id: str, user_id: str) -> WorkspaceMember | None:
    return (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id)
        .first()
    )


def _check_admin_or_owner(member: WorkspaceMember):
    if member.role not in [WorkspaceRole.owner, WorkspaceRole.admin]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


@router.post("", response_model=WorkspaceOut)
def create_workspace(
    payload: WorkspaceCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ws = Workspace(name=payload.name, created_by=current_user.id)
    db.add(ws)
    db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=current_user.id, role=WorkspaceRole.owner))
    db.commit()
    return WorkspaceOut(
        id=ws.id,
        name=ws.name,
        created_by=ws.created_by,
        created_at=ws.created_at,
        role=WorkspaceRole.owner.value,
        is_personal=is_personal_workspace(ws, current_user, WorkspaceRole.owner),
    )


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .filter(WorkspaceMember.user_id == current_user.id)
        .order_by(Workspace.created_at.asc())
        .all()
    )
    return [
        WorkspaceOut(
            id=w.id,
            name=w.name,
            created_by=w.created_by,
            created_at=w.created_at,
            role=role.value,
            is_personal=is_personal_workspace(w, current_user, role),
        )
        for w, role in rows
    ]


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
    _check_admin_or_owner(member)

    try:
        role = WorkspaceRole(payload.role)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role") from exc

    token = create_random_token()
    invite = WorkspaceInvite(
        workspace_id=workspace_id,
        email=payload.email.lower(),
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
def list_pending_invites(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = _membership(db, workspace_id, current_user.id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    _check_admin_or_owner(member)

    rows = (
        db.query(WorkspaceInvite)
        .filter(
            WorkspaceInvite.workspace_id == workspace_id,
            WorkspaceInvite.accepted_at.is_(None),
            WorkspaceInvite.revoked_at.is_(None),
        )
        .order_by(WorkspaceInvite.created_at.desc())
        .all()
    )
    return [
        WorkspaceInviteOut(
            id=row.id,
            email=row.email,
            role=row.role.value,
            created_at=row.created_at,
            expires_at=row.expires_at,
        )
        for row in rows
    ]


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
    _check_admin_or_owner(member)

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

