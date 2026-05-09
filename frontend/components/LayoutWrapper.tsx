"use client";

import { PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const noShellRoutes = ["/", "/login", "/register", "/verify-email", "/accept-invite"];

export default function LayoutWrapper({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const noShell = noShellRoutes.includes(pathname);

  if (noShell) {
    return <>{children}</>;
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", minHeight: "100vh" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, minHeight: "100vh" }}>
        <Topbar />
        <main style={{ padding: 20 }}>{children}</main>
      </div>
    </div>
  );
}

