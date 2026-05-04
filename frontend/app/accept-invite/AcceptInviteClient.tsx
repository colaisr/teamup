"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function AcceptInviteClient() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState(t("invite.status.waiting"));

  useEffect(() => {
    async function run() {
      if (!token) {
        setStatus(t("invite.error.noToken"));
        return;
      }
      try {
        const res = await api<{ message: string }>("/api/workspaces/invites/accept", {
          method: "POST",
          body: JSON.stringify({ token })
        });
        setStatus(res.message);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t("invite.error.generic");
        setStatus(message);
      }
    }
    run();
  }, [token]);

  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: 20 }}>
      <h1>{t("invite.title")}</h1>
      <p>{status}</p>
    </main>
  );
}
