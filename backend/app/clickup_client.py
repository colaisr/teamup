from datetime import datetime
from typing import Any

import requests

from app.config import settings


def status_label_from_clickup_status_cell(cell: dict[str, Any] | Any) -> str | None:
    if not isinstance(cell, dict):
        return None
    inner = cell.get("status")
    if isinstance(inner, str):
        return inner
    if isinstance(inner, dict):
        return inner.get("status")
    return None


def clickup_status_field_label(raw: dict[str, Any] | str | Any) -> str | None:
    """Normalize task / history `status` — ClickUp sometimes returns a string, sometimes a nested object."""
    if raw is None:
        return None
    if isinstance(raw, str):
        s = raw.strip()
        return s if s else None
    return status_label_from_clickup_status_cell(raw)


class ClickUpClient:
    def __init__(self, token: str):
        self.token = token
        self.base = settings.clickup_api_base.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": self.token, "Content-Type": "application/json"}

    def verify(self) -> dict[str, Any]:
        resp = requests.get(f"{self.base}/user", headers=self._headers(), timeout=20)
        resp.raise_for_status()
        return resp.json()

    def get_teams(self) -> list[dict[str, Any]]:
        resp = requests.get(f"{self.base}/team", headers=self._headers(), timeout=20)
        resp.raise_for_status()
        return resp.json().get("teams", [])

    def get_spaces(self, team_id: str) -> list[dict[str, Any]]:
        resp = requests.get(f"{self.base}/team/{team_id}/space", headers=self._headers(), timeout=20)
        resp.raise_for_status()
        return resp.json().get("spaces", [])

    def get_lists(self, folder_id: str) -> list[dict[str, Any]]:
        resp = requests.get(f"{self.base}/folder/{folder_id}/list", headers=self._headers(), timeout=20)
        resp.raise_for_status()
        return resp.json().get("lists", [])

    def collect_list_ids_in_space(self, space_id: str) -> list[str]:
        """Lists under a Space (folderless + folders → lists). MVP: one folder level."""
        ids: list[str] = []
        resp = requests.get(f"{self.base}/space/{space_id}/list", headers=self._headers(), timeout=30)
        resp.raise_for_status()
        ids.extend(str(x["id"]) for x in resp.json().get("lists") or [] if x.get("id"))

        rf = requests.get(f"{self.base}/space/{space_id}/folder", headers=self._headers(), timeout=30)
        rf.raise_for_status()
        for folder in rf.json().get("folders") or []:
            fid = folder.get("id")
            if not fid:
                continue
            for lst in self.get_lists(str(fid)):
                if lst.get("id"):
                    ids.append(str(lst["id"]))
        return ids

    def list_status_strings_for_list_payload(self, list_payload: dict[str, Any]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for raw in list_payload.get("statuses") or []:
            if not isinstance(raw, dict):
                continue
            lab = status_label_from_clickup_status_cell(raw)
            if lab and lab not in seen:
                seen.add(lab)
                result.append(lab)
        return result

    def union_status_strings_for_space(self, space_id: str) -> list[str]:
        seen: set[str] = set()
        merged: list[str] = []
        for lid in self.collect_list_ids_in_space(space_id):
            info = self.get_list(lid)
            for s in self.list_status_strings_for_list_payload(info):
                if s not in seen:
                    seen.add(s)
                    merged.append(s)
        return merged

    def get_list(self, list_id: str) -> dict[str, Any]:
        resp = requests.get(f"{self.base}/list/{list_id}", headers=self._headers(), timeout=20)
        resp.raise_for_status()
        return resp.json()

    def get_tasks_from_list(self, list_id: str, date_created_gt_ms: int | None = None) -> list[dict[str, Any]]:
        params = {"include_closed": "true", "subtasks": "true", "page": 0}
        if date_created_gt_ms:
            params["date_created_gt"] = str(date_created_gt_ms)

        tasks: list[dict[str, Any]] = []
        while True:
            resp = requests.get(f"{self.base}/list/{list_id}/task", headers=self._headers(), params=params, timeout=30)
            resp.raise_for_status()
            payload = resp.json()
            page_tasks = payload.get("tasks", [])
            tasks.extend(page_tasks)
            if not page_tasks:
                break
            params["page"] = int(params["page"]) + 1
        return tasks

    def get_tasks_from_team_space(
        self, clickup_team_id: str, space_id: str, date_created_gt_ms: int | None = None
    ) -> list[dict[str, Any]]:
        page = 0
        merged: list[dict[str, Any]] = []
        while True:
            params: list[tuple[str, str]] = [
                ("include_closed", "true"),
                ("subtasks", "true"),
                ("page", str(page)),
                ("space_ids[]", space_id),
            ]
            if date_created_gt_ms is not None:
                params.append(("date_created_gt", str(date_created_gt_ms)))

            resp = requests.get(
                f"{self.base}/team/{clickup_team_id}/task",
                headers=self._headers(),
                params=params,
                timeout=60,
            )
            resp.raise_for_status()
            chunk = resp.json().get("tasks") or []
            merged.extend(chunk)
            if not chunk or len(chunk) < 100:
                break
            page += 1
        return merged

def parse_clickup_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.utcfromtimestamp(int(ts) / 1000)
    except Exception:
        return None

