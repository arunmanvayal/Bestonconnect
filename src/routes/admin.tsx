import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SupabaseGate } from "@/components/SupabaseGate";

export const Route = createFileRoute("/admin")({
  component: AdminAccess,
});

function AdminAccess() {
  return <SupabaseGate requireCompany={false}><Outlet /></SupabaseGate>;
}