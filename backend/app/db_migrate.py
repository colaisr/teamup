from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_user_is_system_admin_column(engine: Engine) -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("users")}
    if "is_system_admin" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN is_system_admin BOOLEAN NOT NULL DEFAULT false")
            )
        columns = {c["name"] for c in inspector.get_columns("users")}
    if "last_active_workspace_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_active_workspace_id VARCHAR(36) NULL"))


def ensure_clickup_connection_clickup_team_id_column(engine: Engine) -> None:
    inspector = inspect(engine)
    if "clickup_connections" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("clickup_connections")}
    if "clickup_team_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE clickup_connections ADD COLUMN clickup_team_id VARCHAR(64) NULL"))


def ensure_clickup_multi_connection_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "clickup_connections" not in tables:
        return

    conn_columns = {c["name"] for c in inspector.get_columns("clickup_connections")}
    with engine.begin() as conn:
        if "provider" not in conn_columns:
            conn.execute(text("ALTER TABLE clickup_connections ADD COLUMN provider VARCHAR(32) NOT NULL DEFAULT 'clickup'"))
        if "name" not in conn_columns:
            conn.execute(text("ALTER TABLE clickup_connections ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT ''"))
        if "clickup_user_label" not in conn_columns:
            conn.execute(text("ALTER TABLE clickup_connections ADD COLUMN clickup_user_label VARCHAR(255) NULL"))
        if "setup_status" not in conn_columns:
            conn.execute(text("ALTER TABLE clickup_connections ADD COLUMN setup_status VARCHAR(32) NOT NULL DEFAULT 'draft'"))
        if "last_synced_at" not in conn_columns:
            conn.execute(text("ALTER TABLE clickup_connections ADD COLUMN last_synced_at TIMESTAMP NULL"))

        # PostgreSQL: drop legacy one-per-workspace unique constraint.
        if engine.dialect.name == "postgresql":
            uniq = {u.get("name") for u in inspector.get_unique_constraints("clickup_connections")}
            if "uq_clickup_workspace" in uniq:
                conn.execute(text("ALTER TABLE clickup_connections DROP CONSTRAINT uq_clickup_workspace"))

    def _add_connection_id(table: str) -> None:
        if table not in tables:
            return
        cols = {c["name"] for c in inspector.get_columns(table)}
        if "connection_id" in cols:
            return
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN connection_id VARCHAR(36) NULL"))

    _add_connection_id("clickup_raw_events")
    _add_connection_id("tasks")
    _add_connection_id("task_transitions")
    _add_connection_id("workflow_mappings")

    # Backfill connection_id by workspace where legacy rows exist.
    for table in ("clickup_raw_events", "tasks", "task_transitions", "workflow_mappings"):
        if table not in tables:
            continue
        with engine.begin() as conn:
            conn.execute(
                text(
                    f"""
                    UPDATE {table} t
                    SET connection_id = c.id
                    FROM clickup_connections c
                    WHERE t.connection_id IS NULL
                      AND t.workspace_id = c.workspace_id
                    """
                )
            )


def ensure_tasks_task_type_text(engine: Engine) -> None:
    """ClickUp custom_field `value` can be large JSON — widen tasks.task_type past VARCHAR(64)."""
    inspector = inspect(engine)
    if "tasks" not in inspector.get_table_names():
        return
    if engine.dialect.name != "postgresql":
        return
    with engine.begin() as conn:
        udt = conn.execute(
            text(
                "SELECT udt_name FROM information_schema.columns "
                "WHERE table_schema = CURRENT_SCHEMA() AND table_name='tasks' AND column_name='task_type'"
            )
        ).scalar()
        if udt and udt != "text":
            conn.execute(text("ALTER TABLE tasks ALTER COLUMN task_type TYPE TEXT USING task_type::TEXT"))
