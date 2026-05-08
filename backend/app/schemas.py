from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


class MessageResponse(BaseModel):
    message: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    token: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_verified: bool
    is_system_admin: bool = False
    last_active_workspace_id: str | None = None


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)


class WorkspaceUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)


class WorkspaceOut(BaseModel):
    id: str
    name: str
    created_by: str
    created_at: datetime
    role: str | None = None
    is_personal: bool = False
    is_current: bool = False


class WorkspaceSwitchOut(BaseModel):
    workspace_id: str


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "member"


class InviteAcceptRequest(BaseModel):
    token: str


class WorkspaceInviteOut(BaseModel):
    id: str
    email: EmailStr
    role: str
    status: str
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None = None
    revoked_at: datetime | None = None


class WorkspaceMemberOut(BaseModel):
    user_id: str
    email: EmailStr
    full_name: str
    role: str


class WorkspaceMemberRoleUpdate(BaseModel):
    role: str = Field(pattern="^(member|admin)$")


class ClickUpConnectRequest(BaseModel):
    workspace_id: str
    api_token: str
    name: str | None = None


class ClickUpCredentialsUpdateRequest(BaseModel):
    api_token: str
    name: str | None = None


class ClickUpCredentialsSecretOut(BaseModel):
    """Decrypted token for workspace admins editing an existing connection."""

    api_token: str


class ClickUpVerifyTokenRequest(BaseModel):
    api_token: str = Field(min_length=1)


class ClickUpVerifyTokenResponse(BaseModel):
    ok: bool = True
    clickup_email: str | None = None


class ClickUpScopeRequest(BaseModel):
    connection_id: str | None = None
    workspace_id: str | None = None
    scope_type: str = "list"
    scope_id: str
    scope_name: str
    clickup_team_id: str | None = None

    @model_validator(mode="after")
    def require_team_for_space(self) -> ClickUpScopeRequest:
        if not (self.connection_id or self.workspace_id):
            raise ValueError("connection_id or workspace_id is required")
        if self.scope_type == "space" and not (self.clickup_team_id or "").strip():
            raise ValueError("clickup_team_id is required when scope_type is space")
        return self


class WorkflowMappingItem(BaseModel):
    source_status: str
    normalized_status: str


class WorkflowMappingSaveRequest(BaseModel):
    connection_id: str | None = None
    workspace_id: str | None = None
    scope_type: str = Field(default="list", pattern=r"^(list|space)$")
    scope_id: str
    mappings: list[WorkflowMappingItem]

    @model_validator(mode="after")
    def require_connection_or_workspace(self) -> WorkflowMappingSaveRequest:
        if not (self.connection_id or self.workspace_id):
            raise ValueError("connection_id or workspace_id is required")
        return self


class ClickUpConnectionOut(BaseModel):
    id: str
    workspace_id: str
    provider: str
    name: str
    clickup_user_label: str | None = None
    setup_status: str
    scope_type: str | None = None
    scope_id: str | None = None
    scope_name: str | None = None
    clickup_team_id: str | None = None
    last_synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ClickUpConnectionListOut(BaseModel):
    workspace_id: str
    connections: list[ClickUpConnectionOut]


class AttentionTaskOut(BaseModel):
    source_task_id: str
    title: str
    current_status: str | None = None
    attention_score: float
    reasons: list[str]
    suggested_action: str | None = None


class InterventionLogCreate(BaseModel):
    workspace_id: str
    action_type: str
    note: str = ""

