"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";

type Props = { variant?: "card" | "inline" };

export default function AnalyticsMappingBlockedCallout({ variant = "card" }: Props) {
  const body = (
    <>
      <strong>{t("analytics.mappingBlocked.title")}</strong>
      <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.45 }}>
        {t("analytics.mappingBlocked.body")}
      </p>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Link className="btn" href="/settings/integrations">
          {t("analytics.mappingBlocked.ctaIntegrations")}
        </Link>
        <Link className="btn btnGhost" href="/onboarding/mapping">
          {t("analytics.mappingBlocked.ctaHowTo")}
        </Link>
      </div>
    </>
  );

  if (variant === "inline") {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px solid rgba(251, 146, 60, 0.4)",
          background: "rgba(15, 23, 42, 0.6)",
          display: "grid",
          gap: 8,
        }}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        borderColor: "rgba(251, 146, 60, 0.45)",
        display: "grid",
        gap: 8,
      }}
    >
      {body}
    </div>
  );
}
