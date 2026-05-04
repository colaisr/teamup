import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";
import { t } from "@/lib/i18n";

function VerifyFallback() {
  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: 20 }}>
      <h1>{t("auth.verify")}</h1>
      <p>{t("common.loading")}</p>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyEmailClient />
    </Suspense>
  );
}
