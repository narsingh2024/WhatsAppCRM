"use client";

import { use } from "react";

import { ClientDetailView } from "@/components/admin/client-detail";

export default function AdminClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ClientDetailView accountId={id} />;
}
