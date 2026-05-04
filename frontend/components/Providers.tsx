"use client";

import { ReactNode } from "react";
import { AuthModalsProvider } from "@/components/auth/AuthModalsContext";

export default function Providers({ children }: { children: ReactNode }) {
  return <AuthModalsProvider>{children}</AuthModalsProvider>;
}
