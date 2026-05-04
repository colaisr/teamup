"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { api, explainApiError } from "@/lib/api";
import { t } from "@/lib/i18n";

type Props = {
  onClose: () => void;
  onOpenLogin: () => void;
};

export default function RegisterModal({ onClose, onOpenLogin }: Props) {
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
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
    setMessage("");
    try {
      const res = await api<{ message: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName })
      });
      setMessage(res.message);
    } catch (err: unknown) {
      setError(explainApiError(err));
    }
  }

  return (
    <div className="modalBackdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modalPanel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modalHeader">
          <h2 id={titleId}>{t("auth.register")}</h2>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form onSubmit={onSubmit} className="modalForm">
          <label className="modalLabel">
            <span>{t("auth.fullName")}</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
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
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          {message && <p className="modalSuccess">{message}</p>}
          {error && <p className="modalError">{error}</p>}
          <button className="btn modalSubmit" type="submit">
            {t("common.submit")}
          </button>
        </form>
        <p className="modalFooter">
          Уже есть аккаунт?{" "}
          <button type="button" className="modalLink" onClick={onOpenLogin}>
            {t("auth.login")}
          </button>
        </p>
      </div>
    </div>
  );
}
