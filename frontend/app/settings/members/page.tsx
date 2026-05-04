"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type Member = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
};

type MessageRes = { message: string };

export default function MembersPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setWorkspaceId(localStorage.getItem("teamup_workspace_id") || "");
  }, []);

  const notify = useCallback((text: string) => {
    setMessage(text);
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId) {
      notify(t("settings.members.noWorkspace"));
      return;
    }
    const res = await api<MessageRes>(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      body: JSON.stringify({ email, role })
    });
    notify(res.message);
    await loadPendingInvites();
  }

  async function loadMembers() {
    if (!workspaceId) return;
    setMembers(await api<Member[]>(`/api/workspaces/${workspaceId}/members`));
  }

  async function loadPendingInvites() {
    if (!workspaceId) return;
    try {
      setPendingInvites(await api<PendingInvite[]>(`/api/workspaces/${workspaceId}/invites`));
    } catch {
      setPendingInvites([]);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!workspaceId) return;
    const res = await api<MessageRes>(`/api/workspaces/${workspaceId}/invites/${inviteId}/revoke`, {
      method: "POST"
    });
    notify(res.message);
    await loadPendingInvites();
  }

  return (
    <div className="grid">
      <h1>{t("settings.members.title")}</h1>
      <form className="card grid" onSubmit={(e) => void invite(e)}>
        <input
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          placeholder={t("settings.members.workspaceId.placeholder")}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("settings.members.email.placeholder")}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">{t("settings.members.role.member")}</option>
          <option value="admin">{t("settings.members.role.admin")}</option>
        </select>
        <button className="btn" type="submit">
          {t("settings.members.invite")}
        </button>
      </form>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={() => void loadMembers()}>
          {t("settings.members.loadMembers")}
        </button>
        <button className="btn" type="button" onClick={() => void loadPendingInvites()}>
          {t("settings.members.loadPending")}
        </button>
      </div>
      {pendingInvites.length > 0 && (
        <div className="card grid">
          <h3 style={{ margin: 0 }}>{t("settings.members.pendingTitle")}</h3>
          {pendingInvites.map((inv) => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ flex: 1 }}>
                {inv.email} ({inv.role})
              </span>
              <button className="btn" type="button" onClick={() => void revokeInvite(inv.id)}>
                {t("settings.members.revoke")}
              </button>
            </div>
          ))}
        </div>
      )}
      {members.map((member) => (
        <div className="card" key={member.user_id}>
          {member.email} — {member.role}
        </div>
      ))}
      {message && <p>{message}</p>}
    </div>
  );
}
