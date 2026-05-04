"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function VerifyEmailClient() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    async function verify() {
      if (!token) {
        setStatus("err");
        return;
      }
      try {
        await api("/api/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token })
        });
        setStatus("ok");
      } catch {
        setStatus("err");
      }
    }
    verify();
  }, [token]);

  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: 20 }}>
      <h1>{t("auth.verify")}</h1>
      {status === "idle" && <p>{t("common.loading")}</p>}
      {status === "ok" && <p>{t("verify.success")}</p>}
      {status === "err" && <p style={{ color: "#f87171" }}>{t("verify.error")}</p>}
    </main>
  );
}
