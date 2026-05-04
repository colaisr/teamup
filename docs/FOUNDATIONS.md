# TeamUp MVP Foundations (Frozen Before Coding)

This file freezes product and measurement assumptions before implementation.

## 1) Pilot Scope (Frozen)

- Pilot team: internal TeamUp team (~20 people).
- Source system: ClickUp.
- Initial scope: one workspace + one selected list/project.
- Task types in scope for baseline comparisons:
  - Feature
  - Bug
  - Chore/Task

## 2) Lifecycle Definitions (Frozen)

- Active start status category: `In Progress`
- Completion status category: `Done`
- Optional non-delivery completion: `Cancelled`

Metrics:

- Lead Time = `CreatedAt -> DoneAt`
- Cycle Time = `FirstInProgressAt -> DoneAt`
- Time in Status = accumulated duration between status transitions
- Idle Time = open task time with no transition activity above threshold

## 3) Rework and Loop Rules (Frozen)

- Backward transitions count as rework:
  - `QA -> In Progress`
  - `Review -> In Progress`
  - `Done -> In Progress`
- Loop Count increments when the same transition pattern repeats.
- Reopen Rate increments when task reaches `Done` then returns to non-done status.

## 4) Attention Engine Signals (Frozen v1)

- StatusDelayScore: task time in current status vs baseline median/p75.
- LoopScore: number of loop/rework transitions.
- InactivityScore: no transitions beyond idle threshold.
- OverdueScore: due date passed while not done.

Default weighted score:

`AttentionScore = 0.4 * StatusDelay + 0.25 * Loop + 0.2 * Inactivity + 0.15 * Overdue`

## 5) Baseline and Comparison Windows (Frozen)

- Baseline window: last 8-12 weeks of historical ClickUp data.
- Minimum baseline window: 6 weeks.
- First adoption window: 2-4 weeks after dashboard usage starts.
- Comparison method: median + p75, segmented by task type.

## 6) Language and UX Policy (Frozen)

- MVP interface language: Russian (`ru`) by default.
- Fallback locale: English (`en`).
- No hardcoded UI strings allowed in frontend components.

## 7) Governance and Roles (Frozen)

- Workspace roles:
  - `owner`
  - `admin`
  - `member`
- Mapping edits allowed for owner/admin only.
- Integration token updates allowed for owner/admin only.

