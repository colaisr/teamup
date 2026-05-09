from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
import math

from sqlalchemy.orm import Session

from app.models import Task, TaskTransition, WorkflowMapping
from app.schemas import AttentionTaskOut

LEGACY_CONNECTION_KEY = "__legacy__"
DONE_STATUSES = {"Done", "Cancelled"}
ACTIVE_STATUSES = {"In Progress", "Review", "QA"}
REWORK_RETURN_TO = "In Progress"


def active_mapping_by_connection(db: Session, workspace_id: str) -> dict[str, dict[str, str]]:
    rows = db.query(WorkflowMapping).filter(
        WorkflowMapping.workspace_id == workspace_id,
        WorkflowMapping.is_active.is_(True),
    )
    out: dict[str, dict[str, str]] = {}
    for row in rows:
        key = row.connection_id or LEGACY_CONNECTION_KEY
        out.setdefault(key, {})[row.source_status] = row.normalized_status
    return out


def normalize_status(
    mapping_by_connection: dict[str, dict[str, str]],
    connection_id: str | None,
    raw_status: str | None,
) -> str | None:
    if raw_status is None:
        return None
    conn_key = connection_id or LEGACY_CONNECTION_KEY
    scoped = mapping_by_connection.get(conn_key, {})
    if raw_status in scoped:
        return scoped[raw_status]
    legacy = mapping_by_connection.get(LEGACY_CONNECTION_KEY, {})
    return legacy.get(raw_status, raw_status)


def _hours(delta: timedelta | None) -> float:
    if not delta:
        return 0.0
    return round(delta.total_seconds() / 3600, 2)


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    vals = sorted(values)
    n = len(vals)
    return round(vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2, 2)


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return round(values[0], 2)
    vals = sorted(values)
    pos = (len(vals) - 1) * max(0.0, min(1.0, q))
    low = int(math.floor(pos))
    high = int(math.ceil(pos))
    if low == high:
        return round(vals[low], 2)
    frac = pos - low
    return round(vals[low] * (1 - frac) + vals[high] * frac, 2)


def _group_transitions_by_task(transitions: list[TaskTransition]) -> dict[tuple[str, str], list[TaskTransition]]:
    by_task: dict[tuple[str, str], list[TaskTransition]] = defaultdict(list)
    for transition in transitions:
        by_task[(transition.connection_id or "", transition.task_source_id)].append(transition)
    for key in by_task:
        by_task[key] = sorted(by_task[key], key=lambda item: item.transitioned_at)
    return by_task


def _task_type_key(task: Task) -> str:
    return (task.task_type or "unknown").strip() or "unknown"


def _week_bucket(ts: datetime | None) -> str:
    if ts is None:
        return "unknown"
    y, w, _ = ts.isocalendar()
    return f"{y}-W{w:02d}"


def _suggested_action_from_codes(codes: set[str]) -> str:
    if "stuck_in_status" in codes:
        return "Разблокируйте текущий статус и согласуйте конкретный следующий шаг."
    if "high_loop_count" in codes:
        return "Проведите короткий разбор причин возвратов и уточните критерии готовности."
    if "inactivity_breach" in codes:
        return "Запросите апдейт у владельца и зафиксируйте ближайший коммитмент."
    if "overdue_or_open_too_long" in codes:
        return "Пересогласуйте срок или разделите задачу на меньшие поставляемые части."
    return "Проверьте блокеры и уточните следующий шаг."


def _severity_by_score(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.4:
        return "medium"
    return "low"


def _build_task_lifecycle(
    *,
    task: Task,
    history: list[TaskTransition],
    mapping: dict[str, dict[str, str]],
    now: datetime,
) -> dict:
    created_at = task.created_at_source or (history[0].transitioned_at if history else None)
    done_at = task.completed_at_source
    normalized_current = normalize_status(mapping, task.connection_id, task.current_status)
    if done_at is None and normalized_current in DONE_STATUSES and history:
        done_at = history[-1].transitioned_at

    first_active: datetime | None = None
    status_hours: dict[str, float] = defaultdict(float)
    loop_count = 0
    reopen_count = 0
    prev_transition: TaskTransition | None = None

    for transition in history:
        current_norm = normalize_status(mapping, task.connection_id, transition.to_status)
        if not first_active and current_norm in ACTIVE_STATUSES:
            first_active = transition.transitioned_at
        if prev_transition:
            prev_norm = normalize_status(mapping, task.connection_id, prev_transition.to_status)
            span = transition.transitioned_at - prev_transition.transitioned_at
            if prev_norm:
                status_hours[prev_norm] += _hours(span)
            if prev_norm in {"QA", "Review", "Done"} and current_norm == REWORK_RETURN_TO:
                loop_count += 1
            if prev_norm in DONE_STATUSES and current_norm not in DONE_STATUSES:
                reopen_count += 1
        prev_transition = transition

    tail_start: datetime | None = None
    tail_status: str | None = None
    if history:
        tail_start = history[-1].transitioned_at
        tail_status = normalize_status(mapping, task.connection_id, history[-1].to_status)
    elif created_at and normalized_current:
        tail_start = created_at
        tail_status = normalized_current

    tail_end = done_at or now
    if tail_start and tail_status and tail_end > tail_start:
        status_hours[tail_status] += _hours(tail_end - tail_start)

    lead_hours = 0.0
    if created_at and done_at and done_at > created_at:
        lead_hours = round((done_at - created_at).total_seconds() / 3600, 2)

    cycle_hours = 0.0
    if first_active and done_at and done_at > first_active:
        cycle_hours = round((done_at - first_active).total_seconds() / 3600, 2)

    active_hours = round(sum(v for k, v in status_hours.items() if k in ACTIVE_STATUSES), 2)
    idle_hours = round(max(cycle_hours - active_hours, 0.0), 2) if cycle_hours > 0 else 0.0
    flow_efficiency = round((active_hours / cycle_hours) * 100, 2) if cycle_hours > 0 else 0.0

    status_entered_at = tail_start or task.updated_at_source or created_at
    current_status_age_hours = 0.0
    if status_entered_at and tail_end > status_entered_at:
        current_status_age_hours = round((tail_end - status_entered_at).total_seconds() / 3600, 2)

    inactivity_since = task.updated_at_source or status_entered_at or created_at
    inactivity_hours = 0.0
    if inactivity_since and now > inactivity_since:
        inactivity_hours = round((now - inactivity_since).total_seconds() / 3600, 2)

    open_age_hours = 0.0
    if created_at and not done_at and now > created_at:
        open_age_hours = round((now - created_at).total_seconds() / 3600, 2)

    return {
        "task": task,
        "created_at": created_at,
        "done_at": done_at,
        "first_active_at": first_active,
        "normalized_current_status": normalized_current,
        "status_hours": dict(status_hours),
        "lead_hours": lead_hours,
        "cycle_hours": cycle_hours,
        "active_hours": active_hours,
        "idle_hours": idle_hours,
        "flow_efficiency_pct": flow_efficiency,
        "loop_count": loop_count,
        "reopen_count": reopen_count,
        "status_entered_at": status_entered_at,
        "current_status_age_hours": current_status_age_hours,
        "inactivity_hours": inactivity_hours,
        "open_age_hours": open_age_hours,
        "is_open": done_at is None and normalized_current not in DONE_STATUSES,
    }


def _summarize_population(stats: list[dict]) -> dict:
    lead_values = [s["lead_hours"] for s in stats if s["lead_hours"] > 0]
    cycle_values = [s["cycle_hours"] for s in stats if s["cycle_hours"] > 0]
    idle_values = [s["idle_hours"] for s in stats if s["idle_hours"] > 0]
    flow_values = [s["flow_efficiency_pct"] for s in stats if s["flow_efficiency_pct"] > 0]
    total_status: dict[str, float] = defaultdict(float)
    rework_count = 0
    reopen_count = 0
    for stat in stats:
        rework_count += stat["loop_count"]
        reopen_count += stat["reopen_count"]
        for st, hours in stat["status_hours"].items():
            total_status[st] += hours
    denominator = max(len(stats), 1)
    return {
        "median_lead_time_hours": _median(lead_values),
        "median_cycle_time_hours": _median(cycle_values),
        "median_idle_time_hours": _median(idle_values),
        "median_flow_efficiency_pct": _median(flow_values),
        "rework_rate": round(rework_count / denominator, 4),
        "reopen_rate": round(reopen_count / denominator, 4),
        "loop_count_total": rework_count,
        "time_in_status_hours": {k: round(v, 2) for k, v in total_status.items()},
    }


def compute_metrics_payload(db: Session, workspace_id: str) -> dict:
    mapping = active_mapping_by_connection(db, workspace_id)
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    transitions = db.query(TaskTransition).filter(TaskTransition.workspace_id == workspace_id).all()
    by_task = _group_transitions_by_task(transitions)
    now = datetime.utcnow()

    lifecycle_stats: list[dict] = []
    for task in tasks:
        task_key = (task.connection_id or "", task.source_task_id)
        history = by_task.get(task_key, [])
        lifecycle_stats.append(_build_task_lifecycle(task=task, history=history, mapping=mapping, now=now))

    top = _summarize_population(lifecycle_stats)

    by_task_type: dict[str, list[dict]] = defaultdict(list)
    for stat in lifecycle_stats:
        by_task_type[_task_type_key(stat["task"])].append(stat)
    task_type_metrics = {
        k: {
            **_summarize_population(v),
            "task_count": len(v),
        }
        for k, v in by_task_type.items()
    }

    completed_by_week: dict[str, list[dict]] = defaultdict(list)
    created_count_by_week: dict[str, int] = defaultdict(int)
    for stat in lifecycle_stats:
        created_count_by_week[_week_bucket(stat["created_at"])] += 1
        if stat["done_at"]:
            completed_by_week[_week_bucket(stat["done_at"])].append(stat)

    period_keys = sorted(set(created_count_by_week.keys()) | set(completed_by_week.keys()))
    period_metrics: list[dict] = []
    for key in period_keys:
        period_stats = completed_by_week.get(key, [])
        summary = _summarize_population(period_stats) if period_stats else _summarize_population([])
        period_metrics.append(
            {
                "period": key,
                "created_tasks": created_count_by_week.get(key, 0),
                "completed_tasks": len(period_stats),
                "median_lead_time_hours": summary["median_lead_time_hours"],
                "median_cycle_time_hours": summary["median_cycle_time_hours"],
                "median_idle_time_hours": summary["median_idle_time_hours"],
                "median_flow_efficiency_pct": summary["median_flow_efficiency_pct"],
                "rework_rate": summary["rework_rate"],
                "reopen_rate": summary["reopen_rate"],
                "loop_count_total": summary["loop_count_total"],
            }
        )

    return {
        "workspace_id": workspace_id,
        "median_lead_time_hours": top["median_lead_time_hours"],
        "median_cycle_time_hours": top["median_cycle_time_hours"],
        "median_idle_time_hours": top["median_idle_time_hours"],
        "median_flow_efficiency_pct": top["median_flow_efficiency_pct"],
        "rework_rate": top["rework_rate"],
        "reopen_rate": top["reopen_rate"],
        "loop_count_total": top["loop_count_total"],
        "time_in_status_hours": top["time_in_status_hours"],
        "task_count": len(tasks),
        "aggregations": {
            "by_task_type": task_type_metrics,
            "by_period": {
                "bucket": "week",
                "items": period_metrics,
            },
        },
    }


def compute_attention_rows(db: Session, workspace_id: str, *, limit: int | None = 20) -> list[AttentionTaskOut]:
    mapping = active_mapping_by_connection(db, workspace_id)
    tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    transitions = db.query(TaskTransition).filter(TaskTransition.workspace_id == workspace_id).all()
    by_task = _group_transitions_by_task(transitions)

    now = datetime.utcnow()
    lifecycle_stats: list[dict] = []
    status_samples: dict[str, list[float]] = defaultdict(list)
    loop_samples: list[float] = []
    inactivity_samples: list[float] = []
    open_age_samples: list[float] = []

    for task in tasks:
        task_key = (task.connection_id or "", task.source_task_id)
        history = by_task.get(task_key, [])
        stat = _build_task_lifecycle(task=task, history=history, mapping=mapping, now=now)
        lifecycle_stats.append(stat)
        for status, duration in stat["status_hours"].items():
            if duration > 0:
                status_samples[status].append(duration)
        loop_samples.append(float(stat["loop_count"]))
        if stat["inactivity_hours"] > 0:
            inactivity_samples.append(stat["inactivity_hours"])
        if stat["open_age_hours"] > 0:
            open_age_samples.append(stat["open_age_hours"])

    status_p90 = {status: max(24.0, _percentile(values, 0.9)) for status, values in status_samples.items()}
    default_status_p90 = max(24.0, _percentile([v for values in status_samples.values() for v in values], 0.9))
    loop_p90 = max(1.0, _percentile(loop_samples, 0.9))
    inactivity_p90 = max(24.0, _percentile(inactivity_samples, 0.9))
    open_age_p90 = max(72.0, _percentile(open_age_samples, 0.9))

    out: list[AttentionTaskOut] = []
    for stat in lifecycle_stats:
        task = stat["task"]
        if not stat["is_open"]:
            continue
        score = 0.0
        signals: list[dict] = []
        signal_codes: set[str] = set()

        current_status = stat["normalized_current_status"] or "Unknown"
        status_threshold = status_p90.get(current_status, default_status_p90)
        if stat["current_status_age_hours"] >= status_threshold > 0:
            ratio = stat["current_status_age_hours"] / max(status_threshold, 1.0)
            if ratio >= 2.0:
                sev, add = "high", 0.35
            elif ratio >= 1.3:
                sev, add = "medium", 0.24
            else:
                sev, add = "low", 0.14
            score += add
            signal_codes.add("stuck_in_status")
            signals.append(
                {
                    "code": "stuck_in_status",
                    "severity": sev,
                    "score": round(add, 3),
                    "message": f"Статус «{current_status}» длится {round(stat['current_status_age_hours'], 1)}ч (порог P90: {round(status_threshold, 1)}ч).",
                    "threshold_hours": round(status_threshold, 2),
                    "observed_hours": round(stat["current_status_age_hours"], 2),
                }
            )

        if stat["loop_count"] >= loop_p90 and stat["loop_count"] > 0:
            over = stat["loop_count"] - loop_p90
            if over >= 2:
                sev, add = "high", 0.28
            elif over >= 1:
                sev, add = "medium", 0.2
            else:
                sev, add = "low", 0.14
            score += add
            signal_codes.add("high_loop_count")
            signals.append(
                {
                    "code": "high_loop_count",
                    "severity": sev,
                    "score": round(add, 3),
                    "message": f"Высокий loop count: {stat['loop_count']} (порог P90: {round(loop_p90, 1)}).",
                    "threshold_count": round(loop_p90, 2),
                    "observed_count": stat["loop_count"],
                }
            )

        if stat["inactivity_hours"] >= inactivity_p90 > 0:
            ratio = stat["inactivity_hours"] / max(inactivity_p90, 1.0)
            if ratio >= 2.0:
                sev, add = "high", 0.26
            elif ratio >= 1.3:
                sev, add = "medium", 0.18
            else:
                sev, add = "low", 0.12
            score += add
            signal_codes.add("inactivity_breach")
            signals.append(
                {
                    "code": "inactivity_breach",
                    "severity": sev,
                    "score": round(add, 3),
                    "message": f"Нет обновлений {round(stat['inactivity_hours'], 1)}ч (порог P90: {round(inactivity_p90, 1)}ч).",
                    "threshold_hours": round(inactivity_p90, 2),
                    "observed_hours": round(stat["inactivity_hours"], 2),
                }
            )

        overdue_open = False
        overdue_hours = 0.0
        if task.due_at_source and task.due_at_source < now:
            overdue_open = True
            overdue_hours = round((now - task.due_at_source).total_seconds() / 3600, 2)
        open_too_long = stat["open_age_hours"] >= open_age_p90 > 0
        if overdue_open or open_too_long:
            add = 0.22 if overdue_open and open_too_long else 0.16
            score += add
            signal_codes.add("overdue_or_open_too_long")
            msg_parts: list[str] = []
            if overdue_open:
                msg_parts.append(f"просрочена на {round(overdue_hours, 1)}ч")
            if open_too_long:
                msg_parts.append(f"открыта {round(stat['open_age_hours'], 1)}ч (порог P90: {round(open_age_p90, 1)}ч)")
            signals.append(
                {
                    "code": "overdue_or_open_too_long",
                    "severity": "medium" if add < 0.2 else "high",
                    "score": round(add, 3),
                    "message": " и ".join(msg_parts),
                    "threshold_hours": round(open_age_p90, 2),
                    "observed_hours": round(stat["open_age_hours"], 2),
                }
            )

        score = min(1.0, round(score, 3))
        if score > 0:
            reasons = [str(signal.get("message", "")) for signal in signals if signal.get("message")]
            out.append(
                AttentionTaskOut(
                    source_task_id=task.source_task_id,
                    title=task.title,
                    current_status=task.current_status,
                    attention_score=score,
                    severity=_severity_by_score(score),
                    loop_count=stat["loop_count"],
                    signals=signals,
                    reasons=reasons,
                    suggested_action=_suggested_action_from_codes(signal_codes),
                )
            )

    ranked = sorted(out, key=lambda item: item.attention_score, reverse=True)
    if limit is None:
        return ranked
    return ranked[:limit]
