"use client";

import { useEffect, useState } from "react";

const WORKSPACE_KEY = "teamup_workspace_id";
const WORKSPACE_EVENT = "teamup-workspace-changed";

function canUseDom(): boolean {
  return typeof window !== "undefined";
}

export function getActiveWorkspaceId(): string {
  if (!canUseDom()) return "";
  return (window.localStorage.getItem(WORKSPACE_KEY) || "").trim();
}

export function setActiveWorkspaceId(nextWorkspaceId: string): void {
  if (!canUseDom()) return;
  const clean = nextWorkspaceId.trim();
  if (clean) {
    window.localStorage.setItem(WORKSPACE_KEY, clean);
  } else {
    window.localStorage.removeItem(WORKSPACE_KEY);
  }
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_EVENT, {
      detail: { workspaceId: clean },
    })
  );
}

export function useActiveWorkspaceId(initialValue = ""): [string, (nextWorkspaceId: string) => void] {
  const [workspaceId, setWorkspaceIdState] = useState(initialValue);

  useEffect(() => {
    setWorkspaceIdState(getActiveWorkspaceId() || initialValue);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== WORKSPACE_KEY) return;
      setWorkspaceIdState((event.newValue || "").trim());
    };
    const onWorkspaceChange = (event: Event) => {
      const custom = event as CustomEvent<{ workspaceId?: string }>;
      setWorkspaceIdState((custom.detail?.workspaceId || "").trim());
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(WORKSPACE_EVENT, onWorkspaceChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(WORKSPACE_EVENT, onWorkspaceChange);
    };
  }, [initialValue]);

  const setWorkspaceId = (nextWorkspaceId: string) => {
    setActiveWorkspaceId(nextWorkspaceId);
    setWorkspaceIdState(nextWorkspaceId.trim());
  };

  return [workspaceId, setWorkspaceId];
}
