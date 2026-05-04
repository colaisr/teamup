"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

type Member = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
};

export default function MembersPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [members, setMembers] = useState<Member[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setWorkspaceId(localStorage.getItem("teamup_workspace_id") || "");
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ message: string }>(`/api/workspaces/${workspaceId}/invites`, {
      method: "POST",
      body: JSON.stringify({ email, role })
    });
    setMessage(res.message);
  }

  async function loadMembers() {
    setMembers(await api<Member[]>(`/api/workspaces/${workspaceId}/members`));
  }

  return (
    <div className="grid">
      <h1>{t("settings.members.title")}</h1>
      <form className="card grid" onSubmit={invite}>
        <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} placeholder="workspace_id" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">member</option>
          <option value="admin">admin</option>
        </select>
        <button className="btn" type="submit">
          Пригласить
        </button>
      </form>
      <button className="btn" onClick={loadMembers}>
        Загрузить участников
      </button>
      {members.map((member) => (
        <div className="card" key={member.user_id}>
          {member.email} - {member.role}
        </div>
      ))}
      {message && <p>{message}</p>}
    </div>
  );
}

