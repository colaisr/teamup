import { t } from "@/lib/i18n";
import IntegrationsSettingsClient from "./IntegrationsSettingsClient";

export default function IntegrationsSettingsPage() {
  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>{t("settings.integrations.title")}</h1>
      <IntegrationsSettingsClient />
    </div>
  );
}
