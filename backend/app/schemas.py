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
    last_sync_attempt_at: datetime | None = None
    last_sync_error: str | None = None
    sync_scheduler_enabled: bool = False
    sync_interval_minutes: int | None = None
    sync_is_stale: bool = False
    sync_stale_after_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ClickUpConnectionListOut(BaseModel):
    workspace_id: str
    connections: list[ClickUpConnectionOut]
    impact_weekly_snapshot_scheduler_enabled: bool = False
    impact_weekly_snapshot_interval_hours: int = 168
    impact_weekly_snapshot_tick_interval_hours: int = 24


class AttentionTaskOut(BaseModel):
    source_task_id: str
    title: str
    current_status: str | None = None
    attention_score: float
    severity: str = "medium"
    loop_count: int = 0
    reasons: list[str]
    signals: list[dict] = Field(default_factory=list)
    suggested_action: str | None = None


class TaskListItemOut(BaseModel):
    source_task_id: str
    parent_source_task_id: str | None = None
    title: str
    current_status: str | None = None
    normalized_status: str | None = None
    assignee_email: str | None = None
    created_at_source: datetime | None = None
    due_at_source: datetime | None = None
    completed_at_source: datetime | None = None
    updated_at_source: datetime | None = None
    last_synced_at: datetime
    connection_id: str | None = None
    self_attention_score: float = 0.0
    subtree_attention_score: float = 0.0
    attention_reasons: list[str] = Field(default_factory=list)
    child_count: int = 0
    descendant_count: int = 0
    open_descendant_count: int = 0
    is_subtask: bool = False
    parent_title: str | None = None


class TaskListResponse(BaseModel):
    workspace_id: str
    total: int
    returned: int
    items: list[TaskListItemOut]


class InterventionLogCreate(BaseModel):
    workspace_id: str
    action_type: str
    note: str = ""


class AiPlatformSettingsOut(BaseModel):
    """Decrypted credentials for trusted system admins editing the platform AI config."""

    api_key: str = ""
    model_id: str = ""
    updated_at: datetime | None = None


class AiPlatformSettingsPut(BaseModel):
    api_key: str = ""
    model_id: str = ""


class OpenRouterModelBrief(BaseModel):
    id: str
    name: str = ""


class OpenRouterModelsListResponse(BaseModel):
    models: list[OpenRouterModelBrief]


class AiOptionalApiKey(BaseModel):
    """When empty or omitted, stored platform key from DB is used."""

    api_key: str | None = None


class AiTestConnectionResponse(BaseModel):
    ok: bool = True
    message: str = "OK"


class AttentionExplainRequest(BaseModel):
    source_task_id: str = Field(min_length=1)
    model_id: str | None = None
    include_subtasks: bool = False


class AttentionExplainResponse(BaseModel):
    run_id: str
    workspace_id: str
    source_task_id: str
    model_id: str
    summary: str
    takeaways: list[str]
    recommended_actions: list[str]
    evidence_refs: list[str]
    limitations: str = ""


class TaskTimelineEntryOut(BaseModel):
    task_source_id: str
    from_status: str | None = None
    to_status: str
    transitioned_at: datetime


class TaskDetailsOut(BaseModel):
    workspace_id: str
    source_task_id: str
    include_subtasks: bool = False
    descendant_task_ids: list[str] = Field(default_factory=list)
    task: TaskListItemOut
    transitions: list[TaskTimelineEntryOut] = Field(default_factory=list)
    transition_history_unavailable_reason: str | None = None


