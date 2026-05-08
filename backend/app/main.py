from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.db_migrate import (
    ensure_clickup_connection_clickup_team_id_column,
    ensure_clickup_multi_connection_schema,
    ensure_tasks_task_type_text,
    ensure_user_is_system_admin_column,
)
from app.routers import analytics, auth, integrations, workspaces

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
    ensure_clickup_multi_connection_schema(engine)
    ensure_tasks_task_type_text(engine)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(integrations.router)
app.include_router(analytics.router)

