"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthModals } from "@/components/auth/AuthModalsContext";
import { api, setToken } from "@/lib/api";
import { t } from "@/lib/i18n";
import { getActiveWorkspaceId, setActiveWorkspaceId as persistActiveWorkspaceId } from "@/lib/workspace";

const SIDEBAR_COLLAPSED_KEY = "teamup_sidebar_collapsed";
const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 76;

type UserMe = {
  id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  is_system_admin: boolean;
};

type WorkspaceItem = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  role: string | null;
  is_personal: boolean;
  is_current?: boolean;
};

type NavItem = {
  href: string;
  key: string;
};

function getInitials(fullName: string, email: string): string {
  const n = fullName.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const prefix = email.split("@")[0] || "?";
  return prefix.slice(0, 2).toUpperCase();
}

function ToggleRailIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {expanded ? <path d="M11 18l-6-6 6-6M17 6v12" /> : <path d="M13 18l6-6-6-6M7 6v12" />}
    </svg>
  );
}

function NavIcon({ href }: { href: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24" as const, fill: "none", stroke: "currentColor", strokeWidth: 2 };
  switch (href) {
    case "/dashboard":
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "/tasks":
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "/attention":
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v.01M12 12V8" />
        </svg>
      );
    case "/impact":
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 17l6-6 4 4 7-8" />
          <path d="M14 7h7v7" />
        </svg>
      );
    default:
      return (
        <svg {...common} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        </svg>
      );
  }
}

function WorkspacesShortcutIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 21a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4z" />
    </svg>
  );
}

function LogoutIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GearIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.07.06a2 2 0 1 1-3-3l.06-.07a1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.07a2 2 0 0 1 3-3l.07.06A1.65 1.65 0 0 0 9 4.68V4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.07-.06a2 2 0 1 1 3 3v.07l-.06.07a1.65 1.65 0 0 0-.33 1.82V12a2 2 0 1 1 4 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function ShieldIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const baseLinks: NavItem[] = [
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/tasks", key: "nav.tasks" },
  { href: "/attention", key: "nav.attention" },
  { href: "/impact", key: "nav.impact" },
  { href: "/settings/integrations", key: "nav.settings.integrations" }
];

function navItemActiveSimple(item: NavItem, pathname: string): boolean {
  const base = item.href.split("?")[0];
  return pathname === base;
}

export default function SidebarInner() {
  const pathname = usePathname();
  const router = useRouter();
  const { openLogin } = useAuthModals();
  const [me, setMe] = useState<UserMe | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function setCollapsedPersist(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadShellData() {
      try {
        const [meResponse, workspaceResponse] = await Promise.all([
          api<UserMe>("/api/auth/me"),
          api<WorkspaceItem[]>("/api/workspaces")
        ]);
        if (!isMounted) return;
        setMe(meResponse);
        setWorkspaces(workspaceResponse);
      } catch {
        if (!isMounted) return;
        setMe(null);
        setWorkspaces([]);
      }
    }

    void loadShellData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!workspaces.length) {
      setActiveWorkspaceId("");
      return;
    }
    const fromServer = workspaces.find((item) => item.is_current)?.id;
    const stored = getActiveWorkspaceId();
    const hasStored = stored ? workspaces.some((item) => item.id === stored) : false;
    const preferred =
      fromServer ||
      (hasStored ? stored : null) ||
      workspaces.find((item) => item.is_personal)?.id ||
      workspaces[0].id;
    setActiveWorkspaceId(preferred);
    if (preferred !== stored) {
      persistActiveWorkspaceId(preferred);
    }
  }, [workspaces]);

  useEffect(() => {
    if (!me || me.is_system_admin) return;
    if (pathname === "/settings/system" || pathname.startsWith("/settings/system/")) {
      router.replace("/dashboard");
    }
  }, [me, pathname, router]);

  const displayName = me?.full_name?.trim() || t("common.unknownUser");
  const displayEmail = me?.email || "";
  const shortEmail =
    displayEmail.length > 24 ? `${displayEmail.slice(0, 21)}...` : displayEmail;

  async function handleWorkspaceSwitch(nextWorkspaceId: string) {
    await api<unknown>(`/api/workspaces/${nextWorkspaceId}/switch`, { method: "POST" });
    setActiveWorkspaceId(nextWorkspaceId);
    persistActiveWorkspaceId(nextWorkspaceId);
    window.location.reload();
  }

  function handleLogout() {
    setToken(null);
    persistActiveWorkspaceId("");
    openLogin();
    router.push("/", { scroll: false });
  }

  const railBtn: CSSProperties = {
    width: 40,
    height: 40,
    padding: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--panel-soft)",
    color: "var(--text)",
    cursor: "pointer",
    flexShrink: 0
  };

  return (
    <aside
      style={{
        boxSizing: "border-box",
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        flexShrink: 0,
        alignSelf: "flex-start",
        height: "100vh",
        maxHeight: "100dvh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
        borderRight: "1px solid var(--border-strong)",
        padding: collapsed ? "12px 8px" : "16px",
        display: "flex",
        flexDirection: "column",
        gap: collapsed ? 10 : 16,
        transition: "width 160ms ease",
        background: "var(--bg)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
          flexShrink: 0,
          justifyContent: collapsed ? "center" : "flex-start"
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsedPersist(!collapsed)}
          style={railBtn}
          aria-expanded={!collapsed}
          title={collapsed ? t("sidebar.expandAria") : t("sidebar.collapseAria")}
          aria-label={collapsed ? t("sidebar.expandAria") : t("sidebar.collapseAria")}
        >
          <ToggleRailIcon expanded={!collapsed} />
        </button>
        {!collapsed ? (
          <div style={{ fontWeight: 700, minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.2 }}>{t("app.title")}</div>
        ) : null}
      </div>

      <nav
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: collapsed ? 6 : 8,
          paddingRight: 2
        }}
      >
        {baseLinks.map((item) => {
          const active = navItemActiveSimple(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? t(item.key) : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "10px 0" : "8px 10px",
                borderRadius: 8,
                background: active ? "var(--nav-active)" : "transparent",
                color: "var(--text)",
                outline: active ? undefined : undefined
              }}
            >
              <span style={{ flexShrink: 0, display: "grid", placeItems: "center" }}>
                <NavIcon href={item.href} />
              </span>
              {!collapsed ? <span style={{ minWidth: 0 }}>{t(item.key)}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
          paddingTop: 14,
          display: "grid",
          gap: collapsed ? 8 : 10,
          width: "100%",
          minWidth: 0,
          gridTemplateColumns: "minmax(0, 1fr)"
        }}
      >
        {!collapsed ? (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 10px",
              background: "var(--panel-soft)",
              width: "100%",
              minWidth: 0,
              maxWidth: "100%",
              overflow: "hidden",
              boxSizing: "border-box"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0
                }}
                aria-hidden
              >
                {getInitials(me?.full_name?.trim() || "", displayEmail)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 2,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={displayName}
                >
                  {displayName}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={displayEmail}
                >
                  {shortEmail}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                {me?.is_system_admin ? (
                  <Link
                    href="/settings/system"
                    aria-label={t("sidebar.openSystemSettings")}
                    title={t("sidebar.openSystemSettings")}
                    prefetch={false}
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      color:
                        pathname === "/settings/system" || pathname.startsWith("/settings/system/")
                          ? "var(--accent)"
                          : "var(--muted)",
                      background:
                        pathname === "/settings/system" || pathname.startsWith("/settings/system/")
                          ? "rgba(59,130,246,0.15)"
                          : "transparent",
                      border:
                        pathname === "/settings/system" || pathname.startsWith("/settings/system/")
                          ? "1px solid var(--border)"
                          : "1px solid transparent"
                    }}
                  >
                    <ShieldIcon />
                  </Link>
                ) : null}
                <Link
                  href="/settings/user"
                  aria-label={t("sidebar.openUserSettings")}
                  title={t("sidebar.openUserSettings")}
                  prefetch={false}
                  style={{
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    color: pathname.startsWith("/settings/user") ? "var(--accent)" : "var(--muted)",
                    background: pathname.startsWith("/settings/user") ? "rgba(59,130,246,0.15)" : "transparent",
                    border: pathname.startsWith("/settings/user") ? "1px solid var(--border)" : "1px solid transparent"
                  }}
                >
                  <GearIcon />
                </Link>
              </div>
            </div>
            <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={handleLogout}>
              {t("common.logout")}
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--accent)",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0
              }}
              aria-hidden
              title={displayName}
            >
              {getInitials(me?.full_name?.trim() || "", displayEmail)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
              {me?.is_system_admin ? (
                <Link href="/settings/system" prefetch={false} title={t("sidebar.openSystemSettings")} aria-label={t("sidebar.openSystemSettings")} style={{ ...railBtn, textDecoration: "none" }}>
                  <ShieldIcon />
                </Link>
              ) : null}
              <Link href="/settings/user" prefetch={false} title={t("sidebar.openUserSettings")} aria-label={t("sidebar.openUserSettings")} style={{ ...railBtn, textDecoration: "none" }}>
                <GearIcon />
              </Link>
            </div>
            <button type="button" className="btn" style={{ width: "100%", maxWidth: 44, padding: 0, height: 44, display: "grid", placeItems: "center" }} title={t("common.logout")} aria-label={t("common.logout")} onClick={handleLogout}>
              <LogoutIcon size={18} />
            </button>
          </div>
        )}

        {!collapsed ? (
          <div style={{ minWidth: 0, width: "100%" }}>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>
              {t("sidebar.workspaceSwitch")}
            </label>
            <select
              value={activeWorkspaceId}
              onChange={(event) => handleWorkspaceSwitch(event.target.value)}
              disabled={!workspaces.length}
              style={{
                width: "100%",
                background: "var(--panel-soft)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 10px"
              }}
            >
              {!workspaces.length && <option value="">{t("sidebar.noWorkspace")}</option>}
              {workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.is_personal ? ` (${t("sidebar.personalWorkspace")})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Link href="/settings/user?tab=workspaces" prefetch={false} title={t("sidebar.openWorkspacesAria")} aria-label={t("sidebar.openWorkspacesAria")} style={{ ...railBtn, width: "100%", maxWidth: 44, justifySelf: "center", textDecoration: "none" }}>
            <WorkspacesShortcutIcon />
          </Link>
        )}
      </div>
    </aside>
  );
}
