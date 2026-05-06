import { Button } from "@repo/ui/components/button";
import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { integrationConnectionColumns } from "./columns";
import { useDashboardIntegrationQuery } from "@/features/integration/query";
import { useToastError } from "@/lib/toast-error";

export function IntegrationPage() {
  const integrationQuery = useDashboardIntegrationQuery();
  const integrationData = integrationQuery.data;
  useToastError(integrationQuery.error, { title: "Failed to load integrations" });

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => void integrationQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>
      <DashboardTable
        columns={integrationConnectionColumns}
        data={integrationData?.connections ?? []}
        empty="No provider connections available."
      />
    </div>
  );
}
