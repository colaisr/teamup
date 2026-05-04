from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import WorkspaceMember, WorkspaceRole


def get_workspace_membership(db: Session, workspace_id: str, user_id: str) -> WorkspaceMember:
    member = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == user_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return member


def require_admin_or_owner(member: WorkspaceMember) -> None:
    if member.role not in [WorkspaceRole.owner, WorkspaceRole.admin]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

