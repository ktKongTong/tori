import { Button } from "@repo/ui/components/button";
import { Navigate } from "@tanstack/react-router";

import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { notifyEndpointColumns } from "./columns";
import { DeliveryEndpointDialog } from "./create-endpoint-form";
import { useSession } from "@/lib/auth-client";
import { useModal } from "@/lib/modal";
import { useDashboardNotifyEndpointsQuery } from "@/features/notify/query";
import { useToastError } from "@/lib/toast-error";

export function NotifyEndpointsPage() {
  const modal = useModal();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = role.includes("admin");
  const { data: notifyData, refetch, error } = useDashboardNotifyEndpointsQuery();
  useToastError(error, { title: "Failed to load delivery endpoints" });

  if (!isAdmin) {
    return <Navigate to="/notify" replace />;
  }

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => modal.open(<DeliveryEndpointDialog />)}>Register Endpoint</Button>
        <Button onClick={() => refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      <DashboardTable
        columns={notifyEndpointColumns}
        data={notifyData?.deliveryEndpoints ?? []}
        empty="No delivery endpoints available."
      />
    </div>
  );
}
