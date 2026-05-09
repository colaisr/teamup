"use client";

import { Suspense } from "react";
import SidebarInner from "@/components/SidebarInner";

export default function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside
          style={{
            boxSizing: "border-box",
            width: 260,
            flexShrink: 0,
            alignSelf: "flex-start",
            height: "100vh",
            maxHeight: "100dvh",
            borderRight: "1px solid var(--border-strong)"
          }}
          aria-hidden
        />
      }
    >
      <SidebarInner />
    </Suspense>
  );
}
