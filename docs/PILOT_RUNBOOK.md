# TeamUp Pilot Runbook (2-4 Weeks)

## 1) Pilot Start Checklist

- Backend and frontend deployed to production URL.
- Workspace created and members invited.
- ClickUp token connected.
- Scope selected (list/project).
- Historical import completed.
- Workflow mapping confirmed and versioned.
- Baseline snapshot saved via `/api/analytics/impact/snapshot/{workspace_id}?snapshot_type=baseline`.

## 2) Weekly Operating Ritual

Frequency: once per week, 30-45 minutes.

Agenda:

1. Review top tasks from Attention page.
2. Decide interventions (process, priority, staffing, QA handoff).
3. Log interventions via API/UI.
4. Save current snapshot.
5. Compare baseline vs current on Impact page.

## 3) Intervention Logging Convention

Action types:

- `workflow_change`
- `priority_change`
- `staffing_change`
- `qa_process_change`
- `requirements_clarification`

Notes should include:

- Why action was taken.
- Which task(s)/status bottleneck triggered action.
- Expected metric impact.

## 4) End-of-Pilot Report Inputs

- Baseline snapshot
- Last current snapshot
- Top bottleneck shifts (status time deltas)
- Rework/loop trend
- List of interventions and dates

## 5) Go/No-Go Criteria

Go if at least 3 indicators improved:

- Cycle Time down
- Time in bottleneck status down
- Rework/Loop down
- Flow Efficiency up
- Long-idle share down

