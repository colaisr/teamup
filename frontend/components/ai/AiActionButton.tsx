"use client";

import { t } from "@/lib/i18n";

type Props = {
  busy?: boolean;
  onClick: () => void;
  children: string;
};

export default function AiActionButton({ busy = false, onClick, children }: Props) {
  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={onClick}
      style={{ background: "#1e3a8a", borderColor: "#3b82f6" }}
    >
      {busy ? t("ai.busyShort") : children}
    </button>
  );
}
