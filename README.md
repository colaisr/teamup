# TeamUp

TeamUp is a Russian-first engineering process optimization platform MVP.

## Monorepo Structure

- `backend/` — FastAPI API, ingestion, analytics, attention engine
- `frontend/` — Next.js dashboard and onboarding UI
- `infra/` — Docker, Nginx, production deployment scripts
- `docs/` — frozen foundations, glossary, pilot scope, permissions

## Product Source Docs

- `PROJECT_OVERVIEW.md`
- `MVP_IMPLEMENTATION_PLAN.md`
- `MVP_VALUE_MEASUREMENT.md`

## Quick Start

1. Copy env:
   - `cp .env.example .env`
2. Run backend and frontend locally (see their README files).
3. Use Russian UI by default (`ru`).

## Phase 1 (bootstrap) status

Phase 1 from `MVP_IMPLEMENTATION_PLAN.md` is implemented in this repo at a baseline level:

- Auth, workspaces, invitations (create / accept / **list pending / revoke**), email verification flow.
- **CI:** `.github/workflows/ci.yml` runs on push/PR (`backend`: `pytest` + `compileall`; `frontend`: `next lint` + `next build`).

Run the same checks locally:

```bash
(cd backend && pip install -r requirements-dev.txt && python -m compileall app && pytest)
(cd frontend && npm ci && npm run lint && npm run build)
```
