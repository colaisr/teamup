"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";

export default function MappingPage() {
  return (
    <div className="grid">
      <h1>{t("onboarding.mapping.title")}</h1>
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0 }}>
          Маппинг статусов теперь выполняется внутри мастера подключения на странице интеграций.
        </p>
        <Link className="btn" href="/settings/integrations">
          Перейти к подключениям
        </Link>
      </div>
    </div>
  );
}
