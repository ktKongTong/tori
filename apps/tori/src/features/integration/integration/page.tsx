import { DataTable } from "@repo/data-table";
import { Button } from "@repo/ui/components/button";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { createIntegrationConnectionColumns } from "./columns";
import { AddConnectionDialog } from "./create-connection-dialog";
import { useConnectionsQuery } from "@/features/integration/query";
import { useModal } from "@/lib/modal.tsx";

const columns = createIntegrationConnectionColumns();

export function IntegrationPage() {
  const integrationQuery = useConnectionsQuery();
  const integrationData = integrationQuery.data;
  const modal = useModal();
  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => modal.open(<AddConnectionDialog />)}>Add Connection</Button>
        <Button onClick={() => void integrationQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>
      <DataTable
        columns={columns}
        data={integrationData?.data ?? []}
        isLoading={integrationQuery.isLoading}
        error={integrationQuery.error}
        onRetry={() => void integrationQuery.refetch()}
        empty={{
          title: "No provider connections available",
          description: "You have not connected any external provider accounts yet.",
          action: (
            <Button onClick={() => modal.open(<AddConnectionDialog />)} variant="outline">
              Add Connection
            </Button>
          ),
        }}
      />
    </div>
  );
}
