# TeamUp Backend

FastAPI backend for TeamUp MVP.

## Run locally

1. Create venv and install deps:
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
2. Copy env from repo root `.env.example`.
3. Start server:
   - `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

## Endpoints

- Health: `/health`
- Auth: `/api/auth/*`
- Workspaces: `/api/workspaces/*`
- Integrations: `/api/integrations/*`
- Analytics: `/api/analytics/*`

