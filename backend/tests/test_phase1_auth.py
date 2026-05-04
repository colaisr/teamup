"""Smoke tests — Phase 1 CI baseline."""


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_requires_auth(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
