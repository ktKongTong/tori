import { Button } from "@repo/ui/components/button";

import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
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

      <DashboardTable
        columns={bindingChannelColumns}
        data={bindingData?.items ?? []}
        empty="No active channel bindings available."
      />
    </div>
  );
}
