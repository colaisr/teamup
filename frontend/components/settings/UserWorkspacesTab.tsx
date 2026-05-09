"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, explainApiError, getToken } from "@/lib/api";
import { t } from "@/lib/i18n";

type WorkspaceItem = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  role: string | null;
  is_personal: boolean;
  is_current?: boolean;
};

type Member = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string | null;
  status: "pending" | "accepted" | "revoked";
  accepted_at: string | null;
  revoked_at: string | null;
};

type Me = { id: string };

type MessageRes = { message: string };

function activeWorkspaceId(): string {
  return localStorage.getItem("teamup_workspace_id") || "";
}

async function switchWorkspaceReload(id: string) {
  await api<unknown>(`/api/workspaces/${id}/switch`, { method: "POST" });
  localStorage.setItem("teamup_workspace_id", id);
  window.location.reload();
}

export default function UserWorkspacesTab() {
  const [me, setMe] = useState<Me | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [expandedId, setExpandedId] = useState<string>("");
  const [newName, setNewName] = useState("My Team");
  const [inviteEmailByWs, setInviteEmailByWs] = useState<Record<string, string>>({});
  const [inviteRoleByWs, setInviteRoleByWs] = useState<Record<string, string>>({});
  const [membersByWs, setMembersByWs] = useState<Record<string, Member[]>>({});
  const [pendingByWs, setPendingByWs] = useState<Record<string, InviteRow[]>>({});
  const [historyByWs, setHistoryByWs] = useState<Record<string, InviteRow[]>>({});
  const [renameDraftByWs, setRenameDraftByWs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const notify = useCallback((text: string) => {
    setMessage(text);
  }, []);

  const loadWorkspaces = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [wsRes, meRes] = await Promise.all([
        api<WorkspaceItem[]>("/api/workspaces"),
        api<Me>("/api/auth/me")
      ]);
      setWorkspaces(wsRes);
      setMe(meRes);

      const fromServer = wsRes.find((w) => w.is_current)?.id;
      let active = activeWorkspaceId();
      if (fromServer) {
        active = fromServer;
        localStorage.setItem("teamup_workspace_id", fromServer);
      } else if (!active || !wsRes.some((w) => w.id === active)) {
        active = wsRes.find((w) => w.is_personal)?.id || wsRes[0]?.id || "";
        if (active) localStorage.setItem("teamup_workspace_id", active);
      }
    } catch (e: unknown) {
      notify(explainApiError(e));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadWorkspaces();
  }, [loadWorkspaces]);

  async function createWorkspace(ev: FormEvent) {
    ev.preventDefault();
    try {
      const res = await api<WorkspaceItem>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim() || "Workspace" })
      });
      notify(t("settings.user.workspaces.created"));
      setNewName("My Team");
      await loadWorkspaces();
      await switchWorkspaceReload(res.id);
    } catch (e: unknown) {
      notify(explainApiError(e));
    }
  }

  async function saveRename(ws: WorkspaceItem) {
    const name = (renameDraftByWs[ws.id] ?? ws.name).trim();
    if (!name) {
      notify(t("settings.user.workspaces.renameNeedName"));
      return;
    }
    try {
      await api<WorkspaceItem>(`/api/workspaces/${ws.id}`, {
        method: "PUT",
        body: JSON.stringify({ name })
      });
      notify(t("settings.user.workspaces.renamed"));
      await loadWorkspaces();
    } catch (e: unknown) {
      notify(explainApiError(e));
    }
  }

  async function loadMembersFor(workspaceId: string) {
    try {
      const list = await api<Member[]>(`/api/workspaces/${workspaceId}/members`);
      setMembersByWs((prev) => ({ ...prev, [workspaceId]: list }));
    } catch {
      setMembersByWs((prev) => ({ ...prev, [workspaceId]: [] }));
    }
  }

  async function loadPendingFor(workspaceId: string) {
    try {
      const list = await api<InviteRow[]>(
        `/api/workspaces/${workspaceId}/invites?pending_only=true`
      );
      setPendingByWs((prev) => ({ ...prev, [workspaceId]: list }));
    } catch {
      setPendingByWs((prev) => ({ ...prev, [workspaceId]: [] }));
    }
  }

  async function loadHistoryFor(workspaceId: string) {
    try {
      const list = await api<InviteRow[]>(
        `/api/workspaces/${workspaceId}/invites?pending_only=false`
      );
      setHistoryByWs((prev) => ({ ...prev, [workspaceId]: list }));
    } catch {
      setHistoryByWs((prev) => ({ ...prev, [workspaceId]: [] }));
    }
  }

  function toggleExpanded(wsId: string) {
    setExpandedId((cur) => (cur === wsId ? "" : wsId));
  }

  useEffect(() => {
    if (!expandedId) return;
    const ws = workspaces.find((w) => w.id === expandedId);
    void (async () => {
      try {
        const list = await api<Member[]>(`/api/workspaces/${expandedId}/members`);
        setMembersByWs((prev) => ({ ...prev, [expandedId]: list }));
      } catch {
        setMembersByWs((prev) => ({ ...prev, [expandedId]: [] }));
      }
      if (ws?.role === "owner") {
        await loadPendingFor(expandedId);
        await loadHistoryFor(expandedId);
      }
    })();
  }, [expandedId, workspaces]);

  async function submitInvite(workspaceId: string, e: FormEvent) {
    e.preventDefault();
    const email = (inviteEmailByWs[workspaceId] || "").trim();
    const role = inviteRoleByWs[workspaceId] || "member";
    if (!email) {
      notify(t("settings.user.workspaces.needEmail"));
      return;
    }
    try {
      const res = await api<MessageRes>(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        body: JSON.stringify({ email, role })
      });
      notify(res.message);
      setInviteEmailByWs((prev) => ({ ...prev, [workspaceId]: "" }));
      await loadPendingFor(workspaceId);
      await loadHistoryFor(workspaceId);
      await loadMembersFor(workspaceId);
    } catch (err: unknown) {
      notify(explainApiError(err));
    }
  }

  async function revokeInvite(workspaceId: string, inviteId: string) {
    try {
      const res = await api<MessageRes>(
        `/api/workspaces/${workspaceId}/invites/${inviteId}/revoke`,
        { method: "POST" }
      );
      notify(res.message);
      await loadPendingFor(workspaceId);
      await loadHistoryFor(workspaceId);
    } catch (e: unknown) {
      notify(explainApiError(e));
    }
  }

  async function updateMemberRole(workspaceId: string, row: Member, nextRole: string) {
    if (nextRole !== "member" && nextRole !== "admin") return;
    try {
      await api(`/api/workspaces/${workspaceId}/members/${row.user_id}`, {
        method: "PUT",
        body: JSON.stringify({ role: nextRole })
      });
      notify(t("settings.user.workspaces.roleUpdated"));
      await loadMembersFor(workspaceId);
      await loadWorkspaces();
    } catch (e: unknown) {
      notify(explainApiError(e));
    }
  }

  async function removeMember(workspaceId: string, row: Member, isOwnerCtx: boolean) {
    if (row.role === "owner") return;
    const isSelf = row.user_id === me?.id;
    if (!isSelf && !isOwnerCtx) return;
    const text = `${t("settings.user.workspaces.confirmRemoveMemberPrefix")} ${row.email}?`;
    if (typeof window !== "undefined" && !window.confirm(text)) {
      return;
    }
    try {
      await api<MessageRes>(`/api/workspaces/${workspaceId}/members/${row.user_id}`, {
        method: "DELETE"
      });
      notify(t("settings.user.workspaces.memberRemoved"));
      await loadMembersFor(workspaceId);
      if (isSelf) window.location.reload();
    } catch (e: unknown) {
      notify(explainApiError(e));
    }
  }

  function inviteStatusLabel(s: InviteRow["status"]): string {
    if (s === "pending") return t("settings.user.workspaces.inviteStatus.pending");
    if (s === "accepted") return t("settings.user.workspaces.inviteStatus.accepted");
    return t("settings.user.workspaces.inviteStatus.revoked");
  }

  if (loading) return <p className="muted">{t("common.loading")}</p>;

  const currentActive =
    workspaces.find((w) => w.is_current)?.id || activeWorkspaceId();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <p className="muted" style={{ margin: 0 }}>
        {t("settings.user.workspaces.intro")}
      </p>

      <form className="card grid" onSubmit={(e) => void createWorkspace(e)} style={{ margin: 0 }}>
        <div style={{ fontWeight: 600 }}>{t("settings.user.workspaces.createTitle")}</div>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t("settings.user.workspaces.namePlaceholder")}
        />
        <button className="btn" type="submit">
          {t("settings.user.workspaces.createBtn")}
        </button>
      </form>

      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 600 }}>{t("settings.user.workspaces.listTitle")}</div>
        {workspaces.map((ws) => {
          const expanded = expandedId === ws.id;
          const inviteEmail = inviteEmailByWs[ws.id] ?? "";
          const inviteRole = inviteRoleByWs[ws.id] ?? "member";
          const isOwner = ws.role === "owner";
          const canInvite = isOwner;
          const renameDraft = renameDraftByWs[ws.id] ?? ws.name;

          return (
            <div
              key={ws.id}
              className="card"
              style={{ display: "grid", gap: 12, padding: "14px 16px" }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center" }}>
                    <span>{ws.name}</span>
                    {ws.is_personal ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#93c5fd",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          padding: "2px 8px"
                        }}
                      >
                        {t("sidebar.personalWorkspace")}
                      </span>
                    ) : null}
                    {ws.id === currentActive ? (
                      <span style={{ fontSize: 11, color: "#34d399" }}>
                        ({t("settings.user.workspaces.activeBadge")})
                      </span>
                    ) : null}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {t("settings.user.workspaces.yourRole")}: {ws.role ?? "—"}
                  </div>
                  {isOwner ? (
                    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13 }}>{t("settings.user.workspaces.renameLabel")}</span>
                      <input
                        value={renameDraft}
                        style={{ flex: "1 1 200px", minWidth: 0, maxWidth: 360 }}
                        onChange={(e) =>
                          setRenameDraftByWs((prev) => ({ ...prev, [ws.id]: e.target.value }))
                        }
                      />
                      <button className="btn" type="button" onClick={() => void saveRename(ws)}>
                        {t("settings.user.workspaces.renameSave")}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ws.id !== currentActive ? (
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void switchWorkspaceReload(ws.id)}
                    >
                      {t("settings.user.workspaces.setActive")}
                    </button>
                  ) : null}
                  <button className="btn" type="button" onClick={() => toggleExpanded(ws.id)}>
                    {expanded
                      ? t("settings.user.workspaces.collapse")
                      : t("settings.user.workspaces.expandMembers")}
                  </button>
                </div>
              </div>

              {expanded && (
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    paddingTop: 14,
                    display: "grid",
                    gap: 14
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{t("settings.user.workspaces.membersTitle")}</div>
                  {(membersByWs[ws.id] ?? []).length === 0 && (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      {t("settings.user.workspaces.noMembers")}
                    </p>
                  )}
                  {(membersByWs[ws.id] ?? []).map((row) => (
                    <div
                      key={row.user_id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #1e293b"
                      }}
                    >
                      <span>
                        <strong>{row.email}</strong> — {row.full_name?.trim() || "—"}
                        {" — "}
                        {row.role === "member"
                          ? t("settings.members.role.member")
                          : row.role === "admin"
                            ? t("settings.members.role.admin")
                            : row.role === "owner"
                              ? t("settings.members.role.owner")
                              : row.role}
                      </span>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {isOwner &&
                        row.role !== "owner" &&
                        ["member", "admin"].includes(row.role) ? (
                          <select
                            value={row.role}
                            aria-label={`role-${row.user_id}`}
                            onChange={(e) =>
                              void updateMemberRole(ws.id, row, e.target.value)
                            }
                          >
                            <option value="member">{t("settings.members.role.member")}</option>
                            <option value="admin">{t("settings.members.role.admin")}</option>
                          </select>
                        ) : null}
                        {row.role !== "owner" &&
                        (row.user_id === me?.id ||
                          (isOwner && row.user_id !== me?.id)) ? (
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              void removeMember(ws.id, row, isOwner)
                            }
                          >
                            {row.user_id === me?.id
                              ? t("settings.user.workspaces.leaveWorkspace")
                              : t("settings.user.workspaces.removeMember")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}

                  {canInvite ? (
                    <>
                      <div style={{ fontWeight: 600 }}>{t("settings.members.pendingTitle")}</div>
                      {(pendingByWs[ws.id] ?? []).length === 0 ? (
                        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                          —
                        </p>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {(pendingByWs[ws.id] ?? []).map((inv) => (
                            <div
                              key={inv.id}
                              style={{
                                display: "flex",
                                gap: 10,
                                flexWrap: "wrap",
                                alignItems: "center"
                              }}
                            >
                              <span style={{ flex: 1 }}>
                                {inv.email} ({inv.role})
                              </span>
                              <button
                                className="btn"
                                type="button"
                                onClick={() => void revokeInvite(ws.id, inv.id)}
                              >
                                {t("settings.members.revoke")}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <form
                          className="grid"
                          style={{ gap: 8, maxWidth: 480 }}
                          onSubmit={(ev) => void submitInvite(ws.id, ev)}
                        >
                          <div style={{ fontWeight: 600 }}>
                            {t("settings.user.workspaces.inviteTitle")}
                          </div>
                          <input
                            type="email"
                            value={inviteEmail}
                            placeholder={t("settings.members.email.placeholder")}
                            onChange={(e) =>
                              setInviteEmailByWs((prev) => ({
                                ...prev,
                                [ws.id]: e.target.value
                              }))
                            }
                          />
                          <select
                            value={inviteRole}
                            onChange={(e) =>
                              setInviteRoleByWs((prev) => ({
                                ...prev,
                                [ws.id]: e.target.value
                              }))
                            }
                          >
                            <option value="member">{t("settings.members.role.member")}</option>
                            <option value="admin">{t("settings.members.role.admin")}</option>
                          </select>
                          <button className="btn" type="submit">
                            {t("settings.members.invite")}
                          </button>
                        </form>

                      <div style={{ fontWeight: 600 }}>
                        {t("settings.user.workspaces.inviteHistoryTitle")}
                      </div>
                      {(historyByWs[ws.id] ?? []).length === 0 ? (
                        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                          —
                        </p>
                      ) : (
                        <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                          {(historyByWs[ws.id] ?? []).map((inv) => (
                            <div
                              key={inv.id}
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                padding: "6px 0",
                                borderBottom: "1px solid #1e293b"
                              }}
                            >
                              <span>
                                {inv.email} ({inv.role})
                              </span>
                              <span style={{ color: "var(--muted)" }}>
                                {inviteStatusLabel(inv.status)} · {inv.created_at.slice(0, 10)}
                                {inv.accepted_at ? ` · ${inv.accepted_at.slice(0, 10)}` : ""}
                                {inv.revoked_at ? ` · ${inv.revoked_at.slice(0, 10)}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}
                  {!isOwner && ws.role === "member" ? (
                    <p className="muted" style={{ margin: 0 }}>
                      {t("settings.user.workspaces.readOnlyMembers")}
                    </p>
                  ) : null}
                  {!isOwner && ws.role === "admin" ? (
                    <p className="muted" style={{ margin: 0 }}>
                      {t("settings.user.workspaces.ownerOnlyInvites")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {message && (
        <p style={{ margin: 0, color: "var(--text)", fontSize: 14 }}>
          {message}
        </p>
      )}
    </div>
  );
}
