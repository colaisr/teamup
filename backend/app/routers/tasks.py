from __future__ import annotations

import json
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import ClickUpRawEvent, Task, TaskTransition, User
from app.schemas import TaskDetailsOut, TaskListResponse, TaskTimelineEntryOut
from app.services.tasks_view import build_task_list_items
from app.utils import get_workspace_membership

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _descendants(workspace_tasks: list[Task], source_task_id: str) -> list[str]:
    children_by_parent: dict[str, list[str]] = defaultdict(list)
    for task in workspace_tasks:
        if task.parent_source_task_id:
            children_by_parent[task.parent_source_task_id].append(task.source_task_id)
    out: list[str] = []
    seen: set[str] = set()
    stack = list(children_by_parent.get(source_task_id, []))
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        out.append(current)
        stack.extend(children_by_parent.get(current, []))
    return out


def _latest_transition_history_unavailable_reason(db: Session, workspace_id: str) -> str | None:
    event = (
        db.query(ClickUpRawEvent)
        .filter(
            ClickUpRawEvent.workspace_id == workspace_id,
            ClickUpRawEvent.event_type == "clickup.import",
        )
        .order_by(ClickUpRawEvent.created_at.desc())
        .first()
    )
    if not event:
        return None
    try:
        payload = json.loads(event.payload or "{}")
    except (TypeError, ValueError):
        return None
    reason = payload.get("transition_history_unavailable_reason")
    return reason if isinstance(reason, str) and reason.strip() else None


@router.get("/{workspace_id}", response_model=TaskListResponse)
def list_tasks(
    workspace_id: str,
    query: str | None = Query(None, description="Search by title, id, status, assignee"),
    only_attention: bool = False,
    roots_only: bool = False,
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    all_items = build_task_list_items(
        db,
        workspace_id,
        query=query,
        only_attention=only_attention,
        roots_only=roots_only,
    )
    sliced = all_items[offset : offset + limit]
    return TaskListResponse(
        workspace_id=workspace_id,
        total=len(all_items),
        returned=len(sliced),
        items=sliced,
    )


@router.get("/{workspace_id}/{source_task_id}/details", response_model=TaskDetailsOut)
def task_details(
    workspace_id: str,
    source_task_id: str,
    include_subtasks: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_workspace_membership(db, workspace_id, current_user.id)
    items = build_task_list_items(db, workspace_id)
    by_id = {item.source_task_id: item for item in items}
    task_item = by_id.get(source_task_id)
    if task_item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    workspace_tasks = db.query(Task).filter(Task.workspace_id == workspace_id).all()
    descendant_task_ids = _descendants(workspace_tasks, source_task_id) if include_subtasks else []
    scoped_ids = [source_task_id, *descendant_task_ids]

    transitions = (
        db.query(TaskTransition)
        .filter(
            TaskTransition.workspace_id == workspace_id,
            TaskTransition.task_source_id.in_(scoped_ids),
        )
        .order_by(TaskTransition.transitioned_at.asc())
        .all()
    )
    transition_history_unavailable_reason = (
        _latest_transition_history_unavailable_reason(db, workspace_id) if not transitions else None
    )

    return TaskDetailsOut(
        workspace_id=workspace_id,
        source_task_id=source_task_id,
        include_subtasks=include_subtasks,
        descendant_task_ids=descendant_task_ids,
        task=task_item,
        transitions=[
            TaskTimelineEntryOut(
                task_source_id=transition.task_source_id,
                from_status=transition.from_status,
                to_status=transition.to_status,
                transitioned_at=transition.transitioned_at,
            )
            for transition in transitions
        ],
        transition_history_unavailable_reason=transition_history_unavailable_reason,
    )
