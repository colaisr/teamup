"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthModals } from "@/components/auth/AuthModalsContext";

export default function LoginPage() {
  const router = useRouter();
  const { openLogin } = useAuthModals();

  useEffect(() => {
    openLogin();
    router.replace("/", { scroll: false });
  }, [openLogin, router]);

  return (
    <main className="modalRouteFallback">
      <p className="muted">Открываем окно входа...</p>
    </main>
  );
}
