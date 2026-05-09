from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.db_migrate import (
    ensure_clickup_connection_clickup_team_id_column,
    ensure_clickup_connection_sync_observability_columns,
    ensure_clickup_multi_connection_schema,
    ensure_tasks_parent_source_task_id_column,
    ensure_tasks_task_type_text,
    ensure_user_is_system_admin_column,
)
from app.routers import admin_ai, ai, analytics, auth, integrations, tasks, workspaces
from app.services.clickup_scheduler import start_clickup_sync_scheduler, stop_clickup_sync_scheduler
from app.services.impact_weekly_scheduler import (
    start_impact_weekly_snapshot_scheduler,
    stop_impact_weekly_snapshot_scheduler,
)

app = FastAPI(title="TeamUp API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    ensure_user_is_system_admin_column(engine)
    ensure_clickup_connection_clickup_team_id_column(engine)
    ensure_clickup_connection_sync_observability_columns(engine)
    ensure_clickup_multi_connection_schema(engine)
    ensure_tasks_parent_source_task_id_column(engine)
    ensure_tasks_task_type_text(engine)
    start_clickup_sync_scheduler()
    start_impact_weekly_snapshot_scheduler()


@app.on_event("shutdown")
def shutdown():
    stop_clickup_sync_scheduler()
    stop_impact_weekly_snapshot_scheduler()


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(integrations.router)
app.include_router(analytics.router)
app.include_router(admin_ai.router)
app.include_router(ai.router)
app.include_router(tasks.router)

