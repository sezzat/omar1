"use client";

import { usePortal } from "@/components/portal/PortalProvider";
import { PageHeader } from "@/components/portal/ui";

/** Placeholder replaced by the Home screen. */
export default function PortalHome() {
  const { me } = usePortal();
  return <PageHeader title={me.customer.name} />;
}
