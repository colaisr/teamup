"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthModals } from "@/components/auth/AuthModalsContext";

export default function RegisterPage() {
  const router = useRouter();
  const { openRegister } = useAuthModals();

  useEffect(() => {
    openRegister();
    router.replace("/", { scroll: false });
  }, [openRegister, router]);

  return (
    <main className="modalRouteFallback">
      <p className="muted">Открываем окно регистрации...</p>
    </main>
  );
}
