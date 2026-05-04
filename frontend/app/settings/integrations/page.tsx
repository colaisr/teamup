import Link from "next/link";
import { t } from "@/lib/i18n";

export default function IntegrationsSettingsPage() {
  return (
    <div className="grid">
      <h1>{t("settings.integrations.title")}</h1>
      <div className="card">
        <p>Для подключения ClickUp перейдите в онбординг:</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn" href="/onboarding/clickup">
            Подключение ClickUp
          </Link>
          <Link className="btn" href="/onboarding/mapping">
            Маппинг статусов
          </Link>
        </div>
      </div>
    </div>
  );
}

