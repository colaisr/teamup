# MVP Value Measurement Plan

## 1) Purpose

This document defines how to prove MVP value with measurable before/after outcomes.

Goal:

- Show that using the product helps managers identify bottlenecks earlier and improve delivery flow.

Principle:

- The product does not directly "improve" performance by itself.
- It improves decision quality and intervention speed.
- Process metrics should improve as a consequence of better decisions.

Language requirement for measurement UX:

- MVP dashboards, labels, explanations, and intervention notes should be presented in Russian.
- If AI assist is enabled, AI-generated summaries and recommendations should also be Russian-first.

## 2) Measurement Design

### 2.1 Baseline Period (Before Product Use)

- Data source: historical ClickUp data.
- Recommended window: last 8-12 weeks before active product usage.
- Minimum acceptable window: 6 weeks.
- Team scope: same team that will use MVP.

### 2.2 Adoption Period (After Product Use Starts)

- Starts when managers begin using Attention Engine and dashboards in regular routines.
- Recommended first comparison window: 2-4 weeks.
- Recommended second window: 6-8 weeks for stability check.

### 2.3 Comparison Principle

Compare similar sets to avoid false conclusions:

- same team;
- same workflow mapping;
- same task types (or segmented by type);
- same "done" definition;
- similar working calendar context when possible.

## 3) Core Metrics (Required)

These metrics should be included in MVP Value dashboard.

### 3.1 Delivery Speed

1. Lead Time
   - From task creation to completion.
2. Cycle Time
   - From first active work state to completion.
3. Time to Start
   - From creation to first In Progress state.

### 3.2 Flow Performance

4. Time in Status
   - Median time by normalized status category.
5. Idle Time
   - Time with no progress activity while task is open.
6. Flow Efficiency
   - Active Work Time / Total Flow Time (approximation in MVP if active work logs are incomplete).

### 3.3 Quality / Rework

7. Rework Rate
   - Percentage of tasks that move backward in flow.
8. Loop Count
   - Number of repeated stage loops (for example QA <-> Dev).
9. Reopen Rate
   - Percentage of completed tasks reopened later.

## 4) Optional Metrics (Use Carefully)

Optional for MVP, not mandatory:

- Logged developer hours per task.
- Estimate vs actual.
- Assignee-level splits.
- AI Task Description Quality Score (if MVP+ enabled).

Guideline:

- Avoid individual ranking in MVP communication.
- Use these fields for process diagnostics, not person performance scoring.

## 5) Metric Definitions and Baseline Rules

To ensure consistency, freeze definitions at pilot start:

1. Define which mapped status means "start of active work".
2. Define which mapped status means "completed".
3. Define backward transitions counted as rework.
4. Define inactivity threshold for "idle" flag.
5. Define which task types are in analysis scope.

If definitions change, baseline must be recalculated.

## 6) Statistical Reporting Approach

For each metric, report:

- baseline median (and p75 where useful);
- current period median (and p75);
- absolute change;
- percentage change;
- sample size.

Prefer medians over averages for skewed data.

## 7) Value Dashboard Requirements (MVP)

MVP should include a dedicated Value/Impact view with:

1. Before vs After summary cards:
   - Cycle Time
   - Lead Time
   - Flow Efficiency
   - Rework Rate

2. Trend charts:
   - weekly cycle time trend;
   - weekly rework trend;
   - status bottleneck trend.

3. Segmentation:
   - by task type (feature/bug/chore);
   - optional by team subgroup later.

4. "What changed" textual summary:
   - short generated explanations linked to metric movement.

If AI assist is enabled (MVP+):

5. "AI Insights" panel:
   - plain-language bottleneck explanation;
   - top likely reasons based on observed metrics and transitions;
   - suggested manager actions with confidence labels.

## 8) Example Before/After Table Template

| Metric | Baseline | Current | Change | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Median Cycle Time | 5.2 days | 4.1 days | -21% | Delivery accelerated |
| Median QA Time | 18 h | 10 h | -44% | QA bottleneck reduced |
| Rework Rate | 28% | 18% | -10 pp | Fewer back-and-forth loops |
| Flow Efficiency | 14% | 22% | +8 pp | Less waiting vs active work |

## 9) Attribution and Evidence Notes

To support credible value claims:

- keep a changelog of manager interventions inspired by dashboard signals;
- tag interventions by type (workflow change, prioritization, staffing, QA process update);
- connect intervention timing with metric trend shifts.

This helps explain why metrics changed.

For AI-assisted recommendations:

- log which AI suggestion was shown;
- log whether manager accepted/rejected it;
- track associated metric movement after intervention.

## 10) MVP Success Thresholds (Draft)

Pilot can be considered successful if, within 4-8 weeks of use, at least 3 of the following improve:

- Median Cycle Time down by 10-20% (target range).
- Time in primary bottleneck stage down by 15%+.
- Rework/Loop rate down by 10%+.
- Flow Efficiency up by 5-10 percentage points.
- Share of long-idle tasks down by 20%+.

Thresholds are directional and should be refined after first baseline extraction.

If AI assist is enabled, add usage success indicators:

- at least 30-40% of weekly active managers open AI insights panel;
- at least 20% of shown AI actions are accepted as interventions;
- accepted AI actions correlate with measurable directional improvements.

## 11) Risks and Mitigations

Risk 1: Data inconsistency in ClickUp fields.

- Mitigation: run data quality checks during import.

Risk 2: Workflow changes during comparison period.

- Mitigation: record versioned workflow mapping and segment comparisons by mapping version.

Risk 3: Mixed task complexity.

- Mitigation: compare within task type buckets and optionally complexity bands.

Risk 4: Misuse as employee ranking tool.

- Mitigation: emphasize system metrics and process bottlenecks in product copy and dashboards.

Risk 5: AI hallucination or vague recommendations.

- Mitigation: ground all AI prompts with deterministic metrics and current task facts only.
- Mitigation: use restricted recommendation templates and include "why" evidence.
- Mitigation: keep deterministic engine as source of truth.

## 12) Output Required from MVP

By end of MVP pilot, the product must produce:

1. Baseline metrics snapshot.
2. Current-period metrics snapshot.
3. Automated before/after comparison report.
4. Top bottleneck and rework drivers.
5. Evidence-backed statement of value for internal/external pilot discussions.

If MVP+ AI assist is included:

6. AI usage and action acceptance report.
7. Correlation view of accepted AI actions vs metric movement.
