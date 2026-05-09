import { useMemo, useState } from "react";
import { DataTable } from "@repo/data-table";
import { Button } from "@repo/ui/components/button";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { createIntegrationConnectionColumns } from "./columns";
import { ConnectionDetailSheet } from "./detail-sheet";
import { useConnectionsQuery } from "@/features/integration/query";
import { useToastError } from "@/lib/toast-error";
import type { IntegrationConnectionListItem } from "@/features/integration/api";

export function IntegrationPage() {
  const [selectedItem, setSelectedItem] = useState<IntegrationConnectionListItem | null>(null);
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
        <Button onClick={() => void integrationQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>
      <DataTable
        columns={columns}
        data={integrationData?.items ?? []}
        empty={{
          title: "No provider connections available",
          description: "You have not connected any external provider accounts yet.",
        }}
      />
      {selectedItem ? (
        <ConnectionDetailSheet item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </div>
  );
}
