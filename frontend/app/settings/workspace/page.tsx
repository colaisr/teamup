"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function WorkspaceSettingsPage() {
  const [name, setName] = useState("My Team");
  const [message, setMessage] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");

  useEffect(() => {
    setWorkspaceId(localStorage.getItem("teamup_workspace_id") || "");
  }, []);

  async function createWorkspace(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ id: string; name: string }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    localStorage.setItem("teamup_workspace_id", res.id);
    setWorkspaceId(res.id);
    setMessage(`Workspace создан: ${res.name} (${res.id})`);
  }

  return (
    <div className="grid">
      <h1>{t("settings.workspace.title")}</h1>
      <form className="card grid" onSubmit={createWorkspace}>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" type="submit">
          Создать workspace
        </button>
      </form>
      {workspaceId && <div className="card">Активный workspace: {workspaceId}</div>}
      {message && <p>{message}</p>}
    </div>
  );
}

