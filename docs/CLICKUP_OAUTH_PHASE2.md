# ClickUp OAuth Phase 2 Plan

After MVP stabilization (token-based integration), move to OAuth onboarding.

## Goals

- Remove need for personal API token sharing.
- Support product-grade connection UX for new customers.
- Keep existing token-based workspaces working during transition.

## Planned Steps

1. Register ClickUp OAuth app.
2. Add backend routes:
   - `GET /api/integrations/clickup/oauth/start`
   - `GET /api/integrations/clickup/oauth/callback`
3. Store refresh/access tokens securely and rotate as needed.
4. Add frontend OAuth connect button and callback handling.
5. Keep token-based path for legacy workspaces (migration grace period).
6. Add migration helper to convert workspace to OAuth connection.

## Acceptance Criteria

- New workspace can connect ClickUp using OAuth only.
- Existing token workspaces continue functioning.
- Admin can migrate workspace connection without data loss.

