# TeamUp Backend

FastAPI backend for TeamUp MVP.

## Run locally

1. Create venv and install deps:
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
   - (опционально, как в CI) `pip install -r requirements-dev.txt`
2. Copy env from repo root `.env.example` to repo root `.env`.
3. **PostgreSQL:** use the URL in `.env` (default matches the example). For a local DB in Docker only, from repo root:
   - `docker compose -f infra/docker-compose.postgres.yml up -d`
   - Wait until healthy (`docker compose -f infra/docker-compose.postgres.yml ps`). Tables are created on first API startup (`create_all`).
4. Start server from `backend/`:
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## Tests

From `backend/`:

- `pytest` — smoke tests (`/health`, `/api/auth/me` без авторизации)
- `python -m compileall app` — проверка импортов

## Endpoints

- Health: `/health`
- Auth: `/api/auth/*`
- Workspaces: `/api/workspaces/*`
  - `GET /api/workspaces` — список пространств текущего пользователя; у текущего по `last_active_workspace_id` помечается `is_current`
  - `POST /api/workspaces` — создать (создатель = owner); удаления workspace через API нет (как в InfraZen)
  - `POST /api/workspaces/{id}/switch` — выбрать активное пространство (сохраняется в `users.last_active_workspace_id`)
  - `PUT /api/workspaces/{id}` — переименовать (только owner; личное — имя по-прежнему с суффиксом « Personal»)
  - `GET /api/workspaces/{workspace_id}/members` — участники
  - `PUT /api/workspaces/{workspace_id}/members/{user_id}` — сменить роль `member`/`admin` (только owner; владельца не меняют)
  - `DELETE /api/workspaces/{id}/members/{user_id}` — покинуть самому (не owner) или исключить другого (только owner)
  - `GET /api/workspaces/{workspace_id}/invites?pending_only=true|false` — приглашения (только owner); `true` — только ожидающие, `false` — полная история (`status`: pending/accepted/revoked)
  - `POST /api/workspaces/{workspace_id}/invites` — пригласить по email (только owner); если пользователь уже зарегистрирован — сразу в участники + запись в истории
  - `POST /api/workspaces/{workspace_id}/invites/{invite_id}/revoke` — отозвать приглашение (только owner)
- Integrations: `/api/integrations/*`
- Analytics: `/api/analytics/*`
