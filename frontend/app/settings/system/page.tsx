"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

import SystemAiSettingsPanel from "./SystemAiSettingsPanel";

type UserMe = {
  is_system_admin: boolean;
};

type TabId = "users" | "ai" | "tab3" | "tab4" | "tab5";

const tabs: { id: TabId; labelKey: string; placeholderKey: string }[] = [
  { id: "users", labelKey: "settings.system.tab.users", placeholderKey: "settings.system.placeholder.users" },
  { id: "ai", labelKey: "settings.system.tab.ai", placeholderKey: "settings.system.placeholder.ai" },
  { id: "tab3", labelKey: "settings.system.tab.tab3", placeholderKey: "settings.system.placeholder.tab3" },
  { id: "tab4", labelKey: "settings.system.tab.tab4", placeholderKey: "settings.system.placeholder.tab4" },
  { id: "tab5", labelKey: "settings.system.tab.tab5", placeholderKey: "settings.system.placeholder.tab5" }
];

export default function SystemSettingsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("users");

  useEffect(() => {
    let isMounted = true;
    async function checkAccess() {
      try {
        const me = await api<UserMe>("/api/auth/me");
        if (!isMounted) return;
        setAllowed(me.is_system_admin);
      } catch {
        if (!isMounted) return;
        setAllowed(false);
      }
    }
    void checkAccess();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (allowed !== false) return;
    router.replace("/dashboard");
  }, [allowed, router]);

  if (allowed === null) return <p className="muted">{t("common.loading")}</p>;
  if (!allowed)
    return <p className="muted">{t("settings.system.deniedRedirect")}</p>;

  const activePlaceholder = tabs.find((x) => x.id === tab)?.placeholderKey ?? tabs[0].placeholderKey;

  return (
    <section style={{ display: "grid", gap: 20, maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>{t("nav.settings.system")}</h1>

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
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        style={{
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 20,
          minHeight: 200,
          background: "#0b1220"
        }}
      >
        {tab === "ai" ? (
          <SystemAiSettingsPanel />
        ) : (
          <p className="muted">{t(activePlaceholder)}</p>
        )}
      </div>
    </section>
  );
}
