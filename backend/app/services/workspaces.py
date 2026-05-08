from app.models import User, Workspace, WorkspaceMember, WorkspaceRole
from sqlalchemy.orm import Session


PERSONAL_SUFFIX = " Personal"


def _personal_workspace_name(user: User) -> str:
    base = user.full_name.strip()
    if not base:
        base = user.email.split("@", 1)[0].strip() or "User"
    return f"{base}{PERSONAL_SUFFIX}"


def is_personal_workspace(workspace: Workspace, user: User, role: WorkspaceRole | None = None) -> bool:
    if workspace.created_by != user.id:
        return False
    if role is not None and role != WorkspaceRole.owner:
        return False
    return workspace.name.endswith(PERSONAL_SUFFIX)


def ensure_personal_workspace(db: Session, user: User) -> Workspace:
    existing = (
        db.query(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .filter(
            WorkspaceMember.user_id == user.id,
            WorkspaceMember.role == WorkspaceRole.owner,
            Workspace.created_by == user.id,
        )
        .order_by(Workspace.created_at.asc())
        .first()
    )
    if existing:
        return existing

    workspace = Workspace(name=_personal_workspace_name(user), created_by=user.id)
    db.add(workspace)
    db.flush()
    db.add(
        WorkspaceMember(
            workspace_id=workspace.id,
            user_id=user.id,
            role=WorkspaceRole.owner,
        )
    )
    if not user.last_active_workspace_id:
        user.last_active_workspace_id = workspace.id
    return workspace


def sync_last_active_workspace(db: Session, user: User) -> None:
    """Ensure last_active_workspace_id points at a workspace the user belongs to (InfraZen-style default)."""
    rows = (
        db.query(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .filter(WorkspaceMember.user_id == user.id)
        .order_by(Workspace.created_at.asc())
        .all()
    )
    if not rows:
        return
    lid = user.last_active_workspace_id
    if lid and any(w.id == lid for w, _ in rows):
        return
    for w, role in rows:
        if is_personal_workspace(w, user, role):
            user.last_active_workspace_id = w.id
            return
    user.last_active_workspace_id = rows[0][0].id
