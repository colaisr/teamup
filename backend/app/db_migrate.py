from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_user_is_system_admin_column(engine: Engine) -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    columns = {c["name"] for c in inspector.get_columns("users")}
    if "is_system_admin" in columns:
        return
    with engine.begin() as conn:
        conn.execute(
            text("ALTER TABLE users ADD COLUMN is_system_admin BOOLEAN NOT NULL DEFAULT false")
        )
