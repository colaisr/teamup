"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UserWorkspacesTab from "@/components/settings/UserWorkspacesTab";
import { useTheme } from "@/components/ThemeProvider";
import { t } from "@/lib/i18n";

export type TabId = "details" | "notifications" | "workspaces";

const tabs: { id: TabId; key: string }[] = [
  { id: "details", key: "settings.user.tab.details" },
  { id: "notifications", key: "settings.user.tab.notifications" },
  { id: "workspaces", key: "settings.user.tab.workspaces" }
];

function isTab(value: string | null): value is TabId {
  return value === "details" || value === "notifications" || value === "workspaces";
}

function UserSettingsClientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<TabId>("details");

  useEffect(() => {
    const fromUrl = searchParams.get("tab");
    setTab(isTab(fromUrl) ? fromUrl : "details");
  }, [searchParams]);

  function selectTab(next: TabId) {
    setTab(next);
    router.replace(`/settings/user?tab=${next}`, { scroll: false });
  }

  return (
    <section style={{ display: "grid", gap: 20, maxWidth: 720 }}>
      <h1 style={{ margin: 0 }}>{t("settings.user.title")}</h1>

      <div role="tablist" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className="btn"
            style={{
              background: tab === item.id ? "var(--accent-strong)" : "var(--panel-soft)",
              opacity: tab === item.id ? 1 : 0.85,
              border: tab === item.id ? "1px solid var(--accent)" : "1px solid var(--border)",
              color: tab === item.id ? "#fff" : "var(--text)"
            }}
            onClick={() => selectTab(item.id)}
          >
            {t(item.key)}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          minHeight: 160,
          background: "var(--panel-soft)"
        }}
      >
        {tab === "details" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="card" style={{ margin: 0, background: "var(--panel)" }}>
              <div style={{ display: "grid", gap: 10 }}>
                <strong>{t("settings.user.theme.title")}</strong>
                <p className="muted" style={{ margin: 0 }}>
                  {t("settings.user.theme.intro")}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: theme === "dark" ? "var(--accent-strong)" : "var(--panel-soft)",
                      border: `1px solid ${theme === "dark" ? "var(--accent)" : "var(--border)"}`,
                      color: theme === "dark" ? "#ffffff" : "var(--text)",
                    }}
                    onClick={() => setTheme("dark")}
                  >
                    {t("settings.user.theme.dark")}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      background: theme === "light" ? "var(--accent-strong)" : "var(--panel-soft)",
                      border: `1px solid ${theme === "light" ? "var(--accent)" : "var(--border)"}`,
                      color: theme === "light" ? "#ffffff" : "var(--text)",
                    }}
                    onClick={() => setTheme("light")}
                  >
                    {t("settings.user.theme.light")}
                  </button>
                </div>
              </div>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {t("settings.user.placeholder.details")}
            </p>
          </div>
        )}
        {tab === "notifications" && <p className="muted">{t("settings.user.placeholder.notifications")}</p>}
        {tab === "workspaces" && <UserWorkspacesTab />}
      </div>
    </section>
  );
}

export default function UserSettingsClient() {
  return (
    <Suspense fallback={<p className="muted">{t("common.loading")}</p>}>
      <UserSettingsClientContent />
    </Suspense>
  );
}
