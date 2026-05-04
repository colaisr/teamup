"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import LoginModal from "@/components/auth/LoginModal";
import RegisterModal from "@/components/auth/RegisterModal";

export type AuthModalMode = "login" | "register" | null;

type AuthModalsContextValue = {
  mode: AuthModalMode;
  openLogin: () => void;
  openRegister: () => void;
  close: () => void;
};

const AuthModalsContext = createContext<AuthModalsContextValue | null>(null);

export function useAuthModals(): AuthModalsContextValue {
  const ctx = useContext(AuthModalsContext);
  if (!ctx) {
    throw new Error("useAuthModals must be used within AuthModalsProvider");
  }
  return ctx;
}

export function AuthModalsProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthModalMode>(null);

  const openLogin = useCallback(() => setMode("login"), []);
  const openRegister = useCallback(() => setMode("register"), []);
  const close = useCallback(() => setMode(null), []);

  const value = useMemo(
    () => ({ mode, openLogin, openRegister, close }),
    [mode, openLogin, openRegister, close]
  );

  return (
    <AuthModalsContext.Provider value={value}>
      {children}
      {mode === "login" && <LoginModal onClose={close} onOpenRegister={() => setMode("register")} />}
      {mode === "register" && <RegisterModal onClose={close} onOpenLogin={() => setMode("login")} />}
    </AuthModalsContext.Provider>
  );
}
