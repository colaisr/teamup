"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function ClickUpOnboardingPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [token, setToken] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [scopeName, setScopeName] = useState("");
  const [message, setMessage] = useState("");

  async function connect(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ message: string }>("/api/integrations/clickup/connect", {
      method: "POST",
      body: JSON.stringify({ workspace_id: workspaceId, api_token: token })
    });
    setMessage(res.message);
  }

  async function saveScope() {
    const res = await api<{ message: string }>("/api/integrations/clickup/scope", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        scope_type: "list",
        scope_id: scopeId,
        scope_name: scopeName
      })
    });
    setMessage(res.message);
    localStorage.setItem("teamup_workspace_id", workspaceId);
  }

  return (
    <div className="grid">
      <h1>{t("onboarding.clickup.title")}</h1>
      <form className="card grid" onSubmit={connect}>
        <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder="workspace_id" />
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={4}
          placeholder="ClickUp Personal API Token"
        />
        <button className="btn" type="submit">
          Подключить
        </button>
      </form>
      <div className="card grid">
        <input value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder="list_id" />
        <input value={scopeName} onChange={(e) => setScopeName(e.target.value)} placeholder="Название scope" />
        <button className="btn" onClick={saveScope}>
          Сохранить scope
        </button>
      </div>
      {message && <p>{message}</p>}
    </div>
  );
}

