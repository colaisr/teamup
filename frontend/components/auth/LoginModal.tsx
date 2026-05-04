"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { api, explainApiError, setToken } from "@/lib/api";
import { t } from "@/lib/i18n";

type Props = {
  onClose: () => void;
  onOpenRegister: () => void;
};

export default function LoginModal({ onClose, onOpenRegister }: Props) {
  const router = useRouter();
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ access_token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(res.access_token);
      onClose();
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(explainApiError(err));
    }
  }

  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modalPanel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modalHeader">
          <h2 id={titleId}>{t("auth.login")}</h2>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form onSubmit={onSubmit} className="modalForm">
          <label className="modalLabel">
            <span>{t("auth.email")}</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="modalLabel">
            <span>{t("auth.password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="modalError">{error}</p>}
          <button className="btn modalSubmit" type="submit">
            {t("common.submit")}
          </button>
        </form>
        <p className="modalFooter">
          Нет аккаунта?{" "}
          <button type="button" className="modalLink" onClick={onOpenRegister}>
            {t("auth.register")}
          </button>
        </p>
      </div>
    </div>
  );
}
