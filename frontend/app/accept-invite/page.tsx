"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

export default function AcceptInvitePage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState("Ожидание...");

  useEffect(() => {
    async function run() {
      if (!token) {
        setStatus("Токен приглашения не найден");
        return;
      }
      try {
        const res = await api<{ message: string }>("/api/workspaces/invites/accept", {
          method: "POST",
          body: JSON.stringify({ token })
        });
        setStatus(res.message);
      } catch (err: any) {
        setStatus(err.message || "Ошибка принятия приглашения");
      }
    }
    run();
  }, [token]);

  return (
    <main style={{ maxWidth: 520, margin: "80px auto", padding: 20 }}>
      <h1>Принятие приглашения</h1>
      <p>{status}</p>
    </main>
  );
}

