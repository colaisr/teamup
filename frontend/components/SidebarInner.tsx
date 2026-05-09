"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthModals } from "@/components/auth/AuthModalsContext";
import { api, setToken } from "@/lib/api";
import { t } from "@/lib/i18n";
import { getActiveWorkspaceId, setActiveWorkspaceId as persistActiveWorkspaceId } from "@/lib/workspace";

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

  return (
    <aside
      style={{
        boxSizing: "border-box",
        width: 260,
        flexShrink: 0,
        minWidth: 0,
        overflowX: "hidden",
        borderRight: "1px solid #1f2937",
        padding: 16,
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}
    >
      <div style={{ fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" }}>{t("app.title")}</div>
      <nav style={{ display: "grid", gap: 8, minWidth: 0, width: "100%" }}>
        {baseLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              background: navItemActiveSimple(item, pathname) ? "#1f2937" : "transparent"
            }}
          >
            {t(item.key)}
          </Link>
        ))}
      </nav>
      <div
        style={{
          marginTop: "auto",
          borderTop: "1px solid #334155",
          paddingTop: 14,
          display: "grid",
          gap: 10,
          width: "100%",
          minWidth: 0,
          gridTemplateColumns: "minmax(0, 1fr)"
        }}
      >
        <div
          style={{
            border: "1px solid #334155",
            borderRadius: 10,
            padding: "10px 10px",
            background: "#0b1220",
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
                background: "#1d4ed8",
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
                  color: "#94a3b8",
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
                        ? "#93c5fd"
                        : "#94a3b8",
                    background:
                      pathname === "/settings/system" || pathname.startsWith("/settings/system/")
                        ? "rgba(59,130,246,0.15)"
                        : "transparent",
                    border:
                      pathname === "/settings/system" || pathname.startsWith("/settings/system/")
                        ? "1px solid #334155"
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
                  color: pathname.startsWith("/settings/user") ? "#93c5fd" : "#94a3b8",
                  background: pathname.startsWith("/settings/user")
                    ? "rgba(59,130,246,0.15)"
                    : "transparent",
                  border: pathname.startsWith("/settings/user") ? "1px solid #334155" : "1px solid transparent"
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
        <div style={{ minWidth: 0, width: "100%" }}>
          <label style={{ fontSize: 12, color: "#94a3b8", display: "block", marginBottom: 6 }}>
            {t("sidebar.workspaceSwitch")}
          </label>
          <select
            value={activeWorkspaceId}
            onChange={(event) => handleWorkspaceSwitch(event.target.value)}
            disabled={!workspaces.length}
            style={{
              width: "100%",
              background: "#0b1220",
              color: "#e2e8f0",
              border: "1px solid #334155",
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
      </div>
    </aside>
  );
}
