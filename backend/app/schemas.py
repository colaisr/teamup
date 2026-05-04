from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


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


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)


class WorkspaceOut(BaseModel):
    id: str
    name: str
    created_by: str
    created_at: datetime
    role: str | None = None
    is_personal: bool = False


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "member"


class InviteAcceptRequest(BaseModel):
    token: str


class WorkspaceMemberOut(BaseModel):
    user_id: str
    email: EmailStr
    full_name: str
    role: str


class ClickUpConnectRequest(BaseModel):
    workspace_id: str
    api_token: str


class ClickUpScopeRequest(BaseModel):
    workspace_id: str
    scope_type: str = "list"
    scope_id: str
    scope_name: str


class WorkflowMappingItem(BaseModel):
    source_status: str
    normalized_status: str


class WorkflowMappingSaveRequest(BaseModel):
    workspace_id: str
    scope_type: str = "list"
    scope_id: str
    mappings: list[WorkflowMappingItem]


class AttentionTaskOut(BaseModel):
    source_task_id: str
    title: str
    current_status: str | None = None
    attention_score: float
    reasons: list[str]
    suggested_action: str


class InterventionLogCreate(BaseModel):
    workspace_id: str
    action_type: str
    note: str = ""

