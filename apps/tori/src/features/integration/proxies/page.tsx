import { Button } from "@repo/ui/components/button";
import { DataTable } from "@repo/data-table";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { integrationProxyColumns } from "./columns";
import { TokenProxyDialog } from "./proxy-dialogs";
import { useModal } from "@/lib/modal";
import { useProxyInstancesQuery } from "@/features/integration/query";
import { useToastError } from "@/lib/toast-error";

export function IntegrationProxiesPage() {
  const modal = useModal();
  const integrationQuery = useProxyInstancesQuery();
  const integrationData = integrationQuery.data;
  useToastError(integrationQuery.error, { title: "Failed to load token proxies" });

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => modal.open(<TokenProxyDialog />)}>Add Token Proxy</Button>
        <Button onClick={() => void integrationQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>
      <DataTable
        columns={integrationProxyColumns}
        data={integrationData?.data ?? []}
        isLoading={integrationQuery.isLoading}
        error={integrationQuery.error}
        onRetry={() => void integrationQuery.refetch()}
        empty={{
          title: "No token proxies",
          description: "No token proxies registered.",
          action: (
            <Button onClick={() => modal.open(<TokenProxyDialog />)} variant="outline">
              Add your first Token Proxy
            </Button>
          ),
        }}
      />
    </div>
  );
}
