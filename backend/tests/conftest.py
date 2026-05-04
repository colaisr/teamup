from __future__ import annotations

import os
from pathlib import Path

import pytest

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_TEST_DB_PATH = _BACKEND_ROOT / "tests" / "_pytest.sqlite3"


def pytest_configure(config):  # noqa: ARG001
    """SQLite test DB URL before ``app.main`` is imported lazily inside fixtures."""
    _TEST_DB_PATH.unlink(missing_ok=True)
    os.environ["DATABASE_URL"] = "sqlite+pysqlite:///tests/_pytest.sqlite3"
    os.environ.setdefault("JWT_SECRET", "pytest-jwt-secret-teamup-xx")
    os.environ.setdefault("APP_ENV", "development")


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c
