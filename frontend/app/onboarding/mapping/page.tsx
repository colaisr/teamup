"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";

export default function MappingPage() {
  return (
    <div className="grid">
      <h1>{t("onboarding.mapping.title")}</h1>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0 }}>{t("onboarding.mapping.intro")}</p>
        <Link className="btn" href="/settings/integrations">
          {t("onboarding.mapping.openIntegrations")}
        </Link>
      </div>
    </div>
  );
}
