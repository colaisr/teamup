# Project Overview

## 1) Product Definition

### Product Name (working)
Engineering Process Optimization Platform

### One-line Description
A platform that analyzes real software delivery workflows, detects bottlenecks and process anti-patterns, and tells managers which tasks require attention now to improve delivery speed and quality.

### Category
Next-generation Software Engineering Intelligence (SEI) focused on actionability:

- Traditional SEI: visibility + dashboards.
- This product: visibility + explanation + prioritized action.

### Market and Language Focus

- Primary market at launch: Russian market.
- MVP interface language: Russian.
- Product should be localization-ready from day one to support future English/global rollout without redesign.

### i18n Policy (Strategic)

- Product UX and all user-facing content are Russian-first in MVP (`ru` default locale).
- Localization architecture is key-based and locale-driven to avoid later rewrites.
- English (`en`) is the initial fallback locale for future expansion.
- Terminology for workflow/metrics must be standardized across screens, emails, and AI text outputs.

## 2) Problem Statement

Engineering leaders often face the same issues:

- Delivery is slower than expected, but root causes are unclear.
- Tasks spend more time waiting than being actively worked on.
- QA and Development loops repeat (QA -> Dev -> QA).
- Cycle time is high and unpredictable.
- Existing tools provide charts, but not clear decisions.

Current market tools are strong at reporting metrics, but weaker at:

- explaining why a delay happens;
- prioritizing which tasks to intervene on first;
- proposing process restructuring options for the specific team context.

## 3) Product Vision

Transform raw workflow data into management actions:

`Task Data -> Lifecycle Reconstruction -> Metrics -> Anomaly Detection -> Explanation -> Action`

AI positioning principle:

- Core truth layer is deterministic and explainable.
- AI layer is assistive (summaries, quality checks, recommendations), not a black box replacement.

The product should answer:

1. What is slowing delivery?
2. Why is it happening?
3. Which tasks need immediate manager attention?
4. What should be changed in the process?

## 4) Target Users and ICP

Primary personas:

- Engineering Manager
- Team Lead
- Delivery Manager / Project Manager
- Head of Engineering / CTO

Initial ICP:

- Team size: 20-200 engineers.
- Uses a task management tool as a source of truth.
- Wants faster and more predictable delivery without micromanagement.

Pilot context:

- First MVP pilot is an internal team of ~20 people using ClickUp.
- Roles include developers, QA, DevOps, and designers.

## 5) Core Product Modules

### 5.1 Integration Layer

Connects external systems and ingests data.

- MVP: ClickUp.
- Next: Yandex Tracker, Jira, Kaiten.
- Later: GitHub / GitLab for richer delivery context.

### 5.2 Normalized Workflow Model

Converts source-specific data to a common lifecycle model so analytics are comparable across teams/tools.

Core entities:

- Workspace / Project / List
- Task
- Status and status transitions
- Assignee
- Task type
- Timestamps and activity markers

### 5.3 Lifecycle Analytics

Computes baseline delivery metrics:

- Lead Time
- Cycle Time
- Time in Status
- Idle Time
- Throughput
- WIP
- Flow Efficiency

### 5.4 Attention Engine (Core Product Value)

Prioritizes tasks requiring intervention now:

- Stuck tasks
- Looping tasks (rework cycles)
- Idle/no-activity tasks
- Overdue or high-risk tasks
- Outlier tasks versus team baseline

For each task, product provides:

- reason for flag;
- severity score;
- suggested next manager action.

### 5.5 Process Intelligence

Finds recurring process-level problems:

- excessive handoffs;
- repeated review gates;
- QA bottlenecks;
- unstable flow variants;
- high waiting-to-working-time ratio.

### 5.6 Recommendation Engine (post-MVP maturity)

Suggests process-level improvements:

- reduce redundant stages;
- rebalance handoffs;
- adjust workflow for branch testing patterns;
- improve task decomposition and acceptance criteria.

### 5.7 AI Assist Layer (MVP+)

Add lightweight AI features without making core analytics opaque:

- Task Description Quality Score (clarity/completeness/testability).
- AI explanation text for flagged tasks and weekly bottlenecks.
- AI-suggested manager actions from a controlled recommendation catalog.

Guardrails:

- AI suggestions never override deterministic calculations.
- Every AI suggestion must reference known metrics/signals.

## 6) Workflow Mapping Strategy

Statuses differ per team, so they must not be hardcoded.

During connection:

1. Import available ClickUp statuses for selected scope.
2. Auto-suggest mapping based on status names.
3. Require user confirmation/edit.
4. Save mapping per connected workspace/list/project.

Normalized categories for MVP:

- Not Started
- Ready
- In Progress
- Review
- QA
- Blocked
- Done
- Cancelled

## 7) Competitive Landscape (International)

The following products should be monitored for ideas and feature benchmarking:

1. LinearB
2. Waydev
3. Jellyfish
4. Swarmia
5. Pluralsight Flow
6. Allstacks
7. Haystack Analytics
8. Athenian
9. DX

Common strengths in this market:

- engineering metrics visibility;
- dashboarding;
- trend tracking;
- some forecasting/automation.

Observed gap and opportunity:

- limited task-level attention prioritization;
- weak root-cause explanation for specific bottlenecks;
- weak process restructuring guidance tailored to each team workflow.

## 8) Differentiation

Positioning statement:

- Not another dashboard.
- A decision engine for software delivery managers.

Core differentiation:

1. Task-level attention prioritization (what to act on now).
2. Process-level analysis (where flow structure breaks).
3. Explanation layer (why this issue is flagged).
4. Action-oriented recommendations (what to change next).
5. Integration strategy for local and global task ecosystems.
6. AI-assisted explanation and task-quality diagnostics on top of trusted metrics.

Guardrail:

- Product must optimize system performance, not rank individuals for micromanagement.

## 9) MVP Scope

MVP objective:
Prove that managers can identify and resolve delivery bottlenecks faster using the product.

In scope:

- User registration and workspace setup.
- Email verification for new user registration.
- Workspace membership and invitations.
- ClickUp integration.
- Historical data import (2-3 months).
- Incremental sync.
- Workflow mapping setup.
- Lifecycle metrics calculation.
- Attention Engine v1.
- Team dashboard shell + admin/settings pages structure.
- Dashboard with:
  - core metrics;
  - top tasks requiring attention;
  - basic trend views.
- Value/Impact view with before/after comparison.

Out of scope for MVP:

- Full ML prediction stack.
- Advanced recommendation automation.
- Multi-integration support in same release.
- White-label packaging.
- Enterprise on-prem deployment.

Planned immediately after MVP (MVP+):

- AI Task Description Quality scoring.
- AI narrative summaries for bottlenecks and impact changes.
- AI next-step suggestions with strict prompt/rule guardrails.

## 10) Product Experience and UX Structure

For TeamUp MVP, reuse the proven interaction model from the Research Flow product structure:

- Clear split between auth/public pages and app shell pages.
- Persistent application shell with sidebar + top bar for authenticated users.
- Workspace-first experience: user belongs to workspace, can invite teammates, and work from shared dashboards.
- Workspace settings and admin pages separated from operational dashboards.

Minimum route groups for TeamUp MVP:

- Public/Auth: landing, login, register, verify-email.
- Onboarding: connect ClickUp, select scope, map statuses.
- App: dashboard, attention, impact (main nav); integrations entry when needed (`/settings/integrations`).
- Settings/Admin: **workspace lifecycle** (create/rename/switch/members/invites) lives under **`/settings/user`** (tab «Рабочие пространства»), not as a duplicate top-level nav item; **`/settings/workspace`** / **`/settings/members`** redirect there; integration settings at **`/settings/integrations`**; system tools at **`/settings/system`** (system admins only).

## 11) Business and GTM Direction

Go-to-market phases:

1. Pilot on internal ClickUp team.
2. Expand to second design partner (Yandex Tracker or Jira team).
3. Productize as SaaS.
4. Add white-label option for task management vendors.

Commercial options:

- SaaS subscription (team-based pricing).
- Enterprise tier later.
- White-label licensing later.

## Implementation wiki (living)

This section tracks **what is implemented in this repository** today. Product vision and backlog remain in §9–§12; phase-by-phase status is summarized in [`MVP_IMPLEMENTATION_PLAN.md`](MVP_IMPLEMENTATION_PLAN.md) §3.2.

### Repository and layout

| Item | Detail |
|------|--------|
| **Repo** | [github.com/colaisr/teamup](https://github.com/colaisr/teamup) — monorepo |
| **`backend/`** | FastAPI, SQLAlchemy, JWT auth, routers under `/api/` |
| **`frontend/`** | Next.js 14 App Router (`app/`), Russian-first i18n (`ru` primary, `en` fallback / ready) |
| **`infra/`** | Docker Compose and deployment-oriented assets |
| **`docs/`** | Product glossary, OAuth phase-2 notes, pilot runbook, etc. |
| **Secrets** | `.env*` not committed; root `.env.example` documents variables |

### Phase 1 platform (implemented)

- **Auth:** registration, login, JWT `Bearer` API access, email verification flow; optional sync of **`last_active_workspace_id`** on login/`me` when membership changes.
- **Workspaces:** roles `owner` / `admin` / `member`; a **personal workspace** is ensured on register and when loading auth/me; **`GET /api/workspaces`** exposes **`is_current`** from persisted preference; **`POST /api/workspaces/{id}/switch`** updates **`users.last_active_workspace_id`** and aligns frontend `teamup_workspace_id` cache.
- **Workspace administration (aligned with InfraZen-style UX):**
  - **No HTTP delete** for a workspace (lifecycle is not torn down via public API).
  - **Rename:** owner via **`PUT /api/workspaces/{id}`** (personal names retain the **` Personal`** suffix rule).
  - **Member roles:** owner sets **`member` / `admin`** via **`PUT /api/workspaces/{id}/members/{user_id}`**; transferring ownership is out of scope for this shorthand.
  - **Removal:** a user may leave (**`DELETE`** on self unless owner); removing **another** user is **owner-only** (not admin).
  - **Invitations:** **`POST`** create, **`POST .../revoke`**, **`GET`** list — **owner-only**. Unknown emails get a pending token flow; **existing registered users are added immediately** (no pending row) where applicable.
  - **Invite visibility:** **`GET .../invites?pending_only=true`** (pending) vs **`pending_only=false`** (full audit trail with **`pending` / `accepted` / `revoked`** statuses and timestamps).
- **Shell UX:** authenticated layout — main nav (**dashboard, attention, impact, integrations**); workspace **switcher** in the sidebar footer; workspace **management** opens from the user card (**gear** → **`/settings/user`** → workspaces tab — no separate «Рабочие пространства» item in the main menu). **System admin** (`users.is_system_admin`) sees shield → **`/settings/system`** where implemented.
- **Settings routes:** `/settings/workspace` and `/settings/members` redirect to **`/settings/user?tab=workspaces`**; `/settings/integrations`; onboarding **`/onboarding/clickup`**, **`/onboarding/mapping`**.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`): backend tests (`pytest`), `compileall`; frontend ESLint and `next build`. Auth-related pages wrap `useSearchParams` usage in **`Suspense`** for Next compatibility.

### ClickUp integration (partial — multi-connection MVP surface)

- **Personal API token** path; **OAuth** deferred (`docs/CLICKUP_OAUTH_PHASE2.md`).
- **Multiple ClickUp connections** per TeamUp workspace (`clickup_connections` with **`connection_id`** on `tasks`, `task_transitions`, `clickup_raw_events`, `workflow_mappings`); DB migration/backfill helpers; PostgreSQL drops legacy **`uq_clickup_workspace`** when present.
- **API (`/api/integrations/...`):** list/create connections by **`workspace_id`**; **`GET`/`PUT`** connection **credentials** (admin-only; **GET** returns decrypted token so the edit wizard can prefill a masked/saved token); scopes (teams/spaces/lists); scope save; statuses; workflow mapping CRUD; **POST import** per **`connection_id`**. Legacy “latest connection” wrappers remain where noted in code for older clients.
- **Settings UI (`/settings/integrations`):** **list** of connections with **Синхронизировать / Редактировать / Отключить / Добавить**; full-screen **wizard** (credentials with verify + spinners → team/Space with refresh spinners → **обязательный** status mapping → done). Footer action order puts **«Назад»** left of primary actions. Workspace UUID override card removed (uses **`localStorage` `teamup_workspace_id`** from the sidebar switcher). **Редактировать** prefetch uses explicit team/Space IDs so selects stay populated after reload.
- **Import:** parses ClickUp **`status`** as string or nested object (**`clickup_status_field_label`**); **`tasks.task_type`** column migrated to **`TEXT`** on PostgreSQL (custom-field JSON longer than VARCHAR(64)); user-facing error detail on failed import commits when possible.
- **Sync:** Available once a **Space/scope id** exists (mapping still required for `ready` and analytics access). Import endpoint accepts **`sync_mode=auto|incremental|full`**; `auto` uses incremental by `date_updated_gt` after last sync (with overlap), otherwise full ~90-day import. Integrations UI exposes **incremental** and **full** actions separately.
- **Sync observability:** `clickup_connections` now stores **`last_sync_attempt_at`**, **`last_sync_error`**, **`last_synced_at`**; frontend displays last attempt/error, timestamps in **browser local time** via `formatApiUtcAsLocal`.
- **Ingestion:** on-demand import is hardened and incremental-capable, but **no scheduled/background Celery sync loop yet**.

### Analytics and product UI (partial)

- **Metrics API:** `GET /api/analytics/metrics/{workspace_id}` — lead/cycle medians, rework/reopen-oriented signals, time-in-status rollup (subset of full MVP metric list); **normalized status mapping respects per-connection workflows** with fallback where `connection_id` is missing on older rows.
- **Attention API:** `GET /api/analytics/attention/{workspace_id}` — scored tasks with textual explanations (rule-based v1).
- **Analytics gate:** metrics/attention/impact and AI attention explain are blocked until workspace ClickUp mappings are fully configured across active connections.
- **Tasks surface:** new **`/tasks`** page for debug + ops views — list/search/filter, parent/subtask hierarchy (expand/collapse and full-subtree controls), self/subtree attention columns, details slide-over with transition timeline.
- **App surfaces:** **`/dashboard`**, **`/tasks`**, **`/attention`**, **`/impact`** with workspace context; fuller dashboard parity (deep bottleneck cards, rich filters, trend charts) vs §9 MVP wording is **still open**.

### AI foundation (MVP+ scaffold, partial)

- **System AI settings (`/settings/system`):** dedicated **AI tab** for system admins — store OpenRouter API key, pick default model, refresh model catalog, test provider connection. Backend routes: **`/api/admin/ai/settings`**, **`/api/admin/ai/models/list`**, **`/api/admin/ai/test-connection`**.
- **Provider abstraction:** `openrouter_client.py` now includes shared provider helpers (model listing, connectivity check, `chat_complete`, model resolution, normalized HTTP error formatting) with config via `OPENROUTER_*` settings.
- **Platform key/model source of truth:** `ai_platform.py` centralizes access to encrypted provider credentials (`platform_ai_settings`) for server-side AI features.
- **Deterministic core extraction for reuse:** analytics logic was moved to `services/analytics_engine.py` so APIs and AI context builders consume the same metrics/attention computations.
- **AI audit trail models:** `ai_runs` + `ai_outputs` added for run metadata and structured outputs (capability id, model, prompt version, status/latency/errors, evidence refs, linked entity ids).
- **First product AI capability:** workspace endpoint **`POST /api/ai/attention/{workspace_id}/explain-task`** (`attention_task_explanation`) builds deterministic context, calls OpenRouter, returns structured narrative (`summary`, `takeaways`, `recommended_actions`, `limitations`, `evidence_refs`) and persists audit rows.
- **Subtree-aware explain:** request flag `include_subtasks` extends context to task descendants (rolled-up reasons/score + combined transitions), used from tasks details panel.
- **Frontend AI shell:** shared scaffolding added (`frontend/components/ai/*`, `frontend/lib/ai.ts`) with a global assistant panel and per-task “Explain with AI” action in `/attention`; generated blocks show takeaways/actions/evidence.
- **Workspace context plumbing:** shared workspace helper (`frontend/lib/workspace.ts`) introduced so AI panel and analytics pages reuse one active workspace source instead of scattered `localStorage` reads.

### Gaps versus full MVP wording (§9)

- Scheduled/background sync orchestration (beyond manual sync modes), deeper retry policy/alerts, baseline/value automation in Impact, PostgreSQL-heavy CI parity, and broader MVP+ AI capabilities (task-quality scoring, workspace/impact narratives, full contextual chat sessions) — see [`MVP_IMPLEMENTATION_PLAN.md`](MVP_IMPLEMENTATION_PLAN.md) cross-cutting notes.

---

## 12) Product Roadmap (High-level)

### Phase 1 (0-2 months)

- ClickUp integration
- Auth + email verification + workspace/invite flow
- Lifecycle analytics
- Attention Engine v1
- Internal pilot launch

### Phase 2 (2-4 months)

- Process insights v1
- Value/Impact reporting refinement
- MVP+ AI assist layer (task quality + narratives)
- Second pilot with external team

### Phase 3 (4-6 months)

- Yandex Tracker or Jira integration
- Multi-team support
- Recommendation engine v1

### Phase 4 (6+ months)

- Additional integrations (Kaiten, Git providers)
- Advanced prediction/anomaly models
- White-label/enterprise options

## 13) Success Criteria

Pilot success should be evaluated by:

- lower median cycle time;
- reduced time in key bottleneck statuses;
- reduced loop/rework rate;
- improved flow efficiency;
- faster manager response to at-risk tasks.

If these move in the right direction over the adoption period, MVP demonstrates product value.
