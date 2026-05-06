import { Button } from "@repo/ui/components/button";
import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { notifyEventColumns } from "./columns";
import { useDashboardNotifyEventsQuery } from "@/features/notify/query";

export function NotifyEventsPage() {
  const { data, refetch } = useDashboardNotifyEventsQuery();
  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      <DashboardTable
        columns={notifyEventColumns}
        data={data?.notificationEvents ?? []}
        empty="No notification events available."
      />
    </div>
  );
}
