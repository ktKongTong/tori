import { Button } from "@repo/ui/components/button";
import { DataTable } from "@repo/data-table";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { bindingChannelColumns } from "./columns";
import { useChannelBindingsQuery } from "@/features/binding/query";
import { useToastError } from "@/lib/toast-error";

export function BindingChannelsPage() {
  const bindingQuery = useChannelBindingsQuery();
  const bindingData = bindingQuery.data;
  useToastError(bindingQuery.error, { title: "Failed to load channel bindings" });

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => void bindingQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      <DataTable
        columns={bindingChannelColumns}
        data={bindingData?.items ?? []}
        empty={{
          title: "No channel bindings",
          description: "No active channel bindings available.",
        }}
      />
    </div>
  );
}
