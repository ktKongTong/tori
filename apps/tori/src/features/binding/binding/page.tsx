import { Button } from "@repo/ui/components/button";
import { DataTable } from "@repo/data-table";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { useModal } from "@/lib/modal";
import { bindingColumns } from "./columns";
import { RedeemTokenDialog } from "./redeem-token-dialog";
import { IssueTokenDialog } from "../claims/issue-token-dialog";
import { useUserBindingsQuery } from "@/features/binding/query";
import { useSession } from "@/lib/auth-client";
import { useToastError } from "@/lib/toast-error";

export function BindingPage() {
  const modal = useModal();
  const { data: session } = useSession();
  const bindingQuery = useUserBindingsQuery();
  const data = bindingQuery.data;

  useToastError(bindingQuery.error, { title: "Failed to load bindings" });

  const userId = session?.user?.id;

  const handleIssueToken = () => {
    if (userId) {
      modal.open(<IssueTokenDialog userId={userId} />);
    }
  };

  const handleRedeemToken = () => {
    modal.open(<RedeemTokenDialog />);
  };

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={handleRedeemToken} variant="outline">
          Redeem Bot Token
        </Button>
        <Button onClick={handleIssueToken} disabled={!userId}>
          Issue Web Token
        </Button>
      </DashboardActionBar>

      <DataTable
        columns={bindingColumns}
        data={data?.items ?? []}
        isLoading={bindingQuery.isLoading}
        error={bindingQuery.error}
        onRetry={() => void bindingQuery.refetch()}
        empty={{
          title: "No user bindings available",
          description: "You have not mapped any bot user identities to Tori accounts yet.",
          action: (
            <div className="flex gap-3">
              <Button onClick={handleRedeemToken} variant="outline">
                Redeem Bot Token
              </Button>
              <Button onClick={handleIssueToken} disabled={!userId}>
                Issue Web Token
              </Button>
            </div>
          ),
        }}
      />
    </div>
  );
}
