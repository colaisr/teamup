"use client";

import { createContext, useContext } from "react";

export type AiAssistantContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
  workspaceId: string;
  pagePath: string;
};

export const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

export function useAiAssistant(): AiAssistantContextValue {
  const ctx = useContext(AiAssistantContext);
  if (!ctx) {
    throw new Error("useAiAssistant must be used inside AiAssistantProvider");
  }
  return ctx;
}
