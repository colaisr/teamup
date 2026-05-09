"use client";

import { t } from "@/lib/i18n";

type Props = {
  summary: string;
  takeaways: string[];
  recommendedActions: string[];
  limitations?: string;
  evidenceRefs?: string[];
};

export default function AiGeneratedBlock({
  summary,
  takeaways,
  recommendedActions,
  limitations,
  evidenceRefs,
}: Props) {
  return (
    <div className="card" style={{ display: "grid", gap: 8, background: "#0f172a" }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{t("ai.blockHeading")}</p>
      <p style={{ margin: 0 }}>{summary}</p>
      {takeaways.length > 0 ? (
        <p style={{ margin: 0 }}>
          {t("ai.takeawaysLabel")} {takeaways.join(" · ")}
        </p>
      ) : null}
      {recommendedActions.length > 0 ? (
        <p style={{ margin: 0 }}>
          {t("ai.nextStepsLabel")} {recommendedActions.join(" · ")}
        </p>
      ) : null}
      {limitations ? (
        <p className="muted" style={{ margin: 0 }}>
          {t("ai.limitationsLabel")} {limitations}
        </p>
      ) : null}
      {evidenceRefs && evidenceRefs.length > 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {t("ai.evidenceLabel")} {evidenceRefs.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
