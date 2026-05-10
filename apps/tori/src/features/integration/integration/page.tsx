import { useMemo, useState } from "react";
import { DataTable } from "@repo/data-table";
import { Button } from "@repo/ui/components/button";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { createIntegrationConnectionColumns } from "./columns";
import { ConnectionDetailSheet } from "./detail-sheet";
import { AddConnectionDialog } from "./create-connection-dialog";
import { useConnectionsQuery } from "@/features/integration/query";
import { useToastError } from "@/lib/toast-error";
import type { IntegrationConnectionListItem } from "@/features/integration/api";

export function IntegrationPage() {
  const [selectedItem, setSelectedItem] = useState<IntegrationConnectionListItem | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const integrationQuery = useConnectionsQuery();
  const integrationData = integrationQuery.data;

  const columns = useMemo(
    () => createIntegrationConnectionColumns({ onOpenDetails: setSelectedItem }),
    [],
  );

  useToastError(integrationQuery.error, { title: "Failed to load integrations" });

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => setAddDialogOpen(true)}>Add Connection</Button>
        <Button onClick={() => void integrationQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>
      <DataTable
        columns={columns}
        data={integrationData?.items ?? []}
        isLoading={integrationQuery.isLoading}
        error={integrationQuery.error}
        onRetry={() => void integrationQuery.refetch()}
        empty={{
          title: "No provider connections available",
          description: "You have not connected any external provider accounts yet.",
          action: (
            <Button onClick={() => setAddDialogOpen(true)} variant="outline">
              Add your first Connection
            </Button>
          ),
        }}
      />
      {selectedItem ? (
        <ConnectionDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
      <AddConnectionDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
    </div>
  );
}
