"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

type TabId = "details" | "notifications" | "workspaces";

const tabs: { id: TabId; key: string }[] = [
  { id: "details", key: "settings.user.tab.details" },
  { id: "notifications", key: "settings.user.tab.notifications" },
  { id: "workspaces", key: "settings.user.tab.workspaces" }
];

export default function UserSettingsPage() {
  const [tab, setTab] = useState<TabId>("details");

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
            onClick={() => setTab(item.id)}
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
        {tab === "workspaces" && <p className="muted">{t("settings.user.placeholder.workspaces")}</p>}
      </div>
    </section>
  );
}
