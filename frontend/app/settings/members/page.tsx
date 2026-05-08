"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MembersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings/user?tab=workspaces");
  }, [router]);
  return null;
}
