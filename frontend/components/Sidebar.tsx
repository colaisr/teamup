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
            borderRight: "1px solid #1f2937"
          }}
          aria-hidden
        />
      }
    >
      <SidebarInner />
    </Suspense>
  );
}
