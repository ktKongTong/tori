import { Button } from "@repo/ui/components/button";
import { Navigate } from "@tanstack/react-router";
import { DataTable } from "@repo/data-table";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { botInstanceColumns } from "./columns";
import { CreateBotInstanceDialog } from "./dialogs";
import { useSession } from "@/lib/auth-client";
import { useModal } from "@/lib/modal";
import { useBotInstancesQuery } from "@/features/bot-instances/query";

export function BotInstancesPage() {
  const modal = useModal();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = role.includes("admin");
  const botInstancesQuery = useBotInstancesQuery();
  const botInstancesData = botInstancesQuery.data?.data;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => modal.open(<CreateBotInstanceDialog />)}>Create Bot Instance</Button>
        <Button onClick={() => void botInstancesQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>
      <DataTable
        columns={botInstanceColumns}
        data={botInstancesData ?? []}
        isLoading={botInstancesQuery.isLoading}
        error={botInstancesQuery.error}
        onRetry={() => void botInstancesQuery.refetch()}
        empty={{
          title: "No bot instances",
          description: "No bot instances available.",
          action: (
            <Button onClick={() => modal.open(<CreateBotInstanceDialog />)} variant="outline">
              Create your first Bot Instance
            </Button>
          ),
        }}
      />
    </div>
  );
}
