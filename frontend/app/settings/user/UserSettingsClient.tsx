"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UserWorkspacesTab from "@/components/settings/UserWorkspacesTab";
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
              background: tab === item.id ? "#1e40af" : "#1f2937",
              opacity: tab === item.id ? 1 : 0.85,
              border: tab === item.id ? "1px solid #3b82f6" : "1px solid #334155"
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
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 20,
          minHeight: 160,
          background: "#0b1220"
        }}
      >
        {tab === "details" && <p className="muted">{t("settings.user.placeholder.details")}</p>}
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
