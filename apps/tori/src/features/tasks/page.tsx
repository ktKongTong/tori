import { Button } from "@repo/ui/components/button";
import { Navigate } from "@tanstack/react-router";
import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { taskColumns } from "./columns";
import { useSession } from "@/lib/auth-client";
import { useDashboardTasksQuery } from "@/features/tasks/query";

export function TasksPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = role.includes("admin");
  const tasksQuery = useDashboardTasksQuery();
  const tasksData = tasksQuery.data;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => void tasksQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      <DashboardTable
        columns={taskColumns}
        data={tasksData?.tasks ?? []}
        empty="No tasks available."
      />
    </div>
  );
}
