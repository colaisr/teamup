"use client";

import { ReactNode } from "react";
import { AiAssistantProvider } from "@/components/ai/AiAssistantProvider";
import { AuthModalsProvider } from "@/components/auth/AuthModalsContext";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthModalsProvider>
      <AiAssistantProvider>{children}</AiAssistantProvider>
    </AuthModalsProvider>
  );
}
