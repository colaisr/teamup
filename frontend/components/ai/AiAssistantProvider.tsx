"use client";

import { type ReactNode, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AiAssistantContext } from "@/components/ai/AiAssistantContext";
import { useActiveWorkspaceId } from "@/lib/workspace";
import AiAssistantPanel from "@/components/ai/AiAssistantPanel";

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [workspaceId] = useActiveWorkspaceId("");
  const pagePath = usePathname();

  const value = useMemo(
    () => ({
      open,
      toggle: () => setOpen((v) => !v),
      close: () => setOpen(false),
      workspaceId,
      pagePath,
    }),
    [open, workspaceId, pagePath]
  );

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
      <AiAssistantPanel />
    </AiAssistantContext.Provider>
  );
}
