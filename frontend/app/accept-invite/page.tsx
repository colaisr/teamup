import { Suspense } from "react";
import AcceptInviteClient from "./AcceptInviteClient";
import { t } from "@/lib/i18n";

function AcceptFallback() {
  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: 20 }}>
      <h1>{t("invite.title")}</h1>
      <p>{t("common.loading")}</p>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptFallback />}>
      <AcceptInviteClient />
    </Suspense>
  );
}
