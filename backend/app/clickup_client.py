from datetime import datetime
from typing import Any

import requests

from app.config import settings


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


def parse_clickup_ts(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.utcfromtimestamp(int(ts) / 1000)
    except Exception:
        return None

