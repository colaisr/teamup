"use client";

import { ReactNode } from "react";
import { AiAssistantProvider } from "@/components/ai/AiAssistantProvider";
import { AuthModalsProvider } from "@/components/auth/AuthModalsContext";
import { ThemeProvider } from "@/components/ThemeProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthModalsProvider>
        <AiAssistantProvider>{children}</AiAssistantProvider>
      </AuthModalsProvider>
    </ThemeProvider>
  );
}
