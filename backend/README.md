# TeamUp Backend

FastAPI backend for TeamUp MVP.

## Run locally

1. Create venv and install deps:
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
   - (опционально, как в CI) `pip install -r requirements-dev.txt`
2. Copy env from repo root `.env.example` to repo root `.env`.
3. Start server from `backend/`:
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## Tests

From `backend/`:

- `pytest` — smoke tests (`/health`, `/api/auth/me` без авторизации)
- `python -m compileall app` — проверка импортов

## Endpoints

- Health: `/health`
- Auth: `/api/auth/*`
- Workspaces: `/api/workspaces/*`
  - `GET /api/workspaces/{workspace_id}/invites` — активные приглашения (admin/owner)
  - `POST /api/workspaces/{workspace_id}/invites/{invite_id}/revoke` — отозвать приглашение
- Integrations: `/api/integrations/*`
- Analytics: `/api/analytics/*`
