import { Button } from "@repo/ui/components/button";
import { DataTable } from "@repo/data-table";
import { Navigate } from "@tanstack/react-router";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { bindingClaimColumns } from "./columns";
import { IssueTokenDialog } from "./issue-token-dialog";
import { useSession } from "@/lib/auth-client";
import { useModal } from "@/lib/modal";
import { useClaimSessionsQuery } from "@/features/binding/query";
import { useToastError } from "@/lib/toast-error";

export function BindingClaimsPage() {
  const { data: session } = useSession();
  const modal = useModal();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = role.includes("admin");

  const bindingQuery = useClaimSessionsQuery();
  const data = bindingQuery.data;

  useToastError(bindingQuery.error, { title: "Failed to load claim sessions" });

  if (!isAdmin) {
    return <Navigate to="/binding" replace />;
  }

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button
          onClick={() => {
            if (session?.user.id) {
              modal.open(<IssueTokenDialog userId={session.user.id} />);
            }
          }}
          disabled={!session?.user.id}
        >
          Issue Token
        </Button>
      </DashboardActionBar>

      <DataTable
        columns={bindingClaimColumns}
        data={data?.items ?? []}
        empty={{ title: "No claim sessions", description: "No claim sessions available." }}
      />
    </div>
  );
}
