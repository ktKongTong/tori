import { Button } from "@repo/ui/components/button";

import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { bindingClaimColumns } from "./columns";
import { IssueTokenDialog } from "./issue-token-dialog";
import { useSession } from "@/lib/auth-client";
import { useModal } from "@/lib/modal";
import { useClaimSessionsQuery } from "@/features/binding/query";
import { useToastError } from "@/lib/toast-error";

export function BindingClaimsPage() {
  const { data: session } = useSession();
  const modal = useModal();
  const bindingQuery = useClaimSessionsQuery();
  const data = bindingQuery.data;

  useToastError(bindingQuery.error, { title: "Failed to load claim sessions" });

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

      <DashboardTable
        columns={bindingClaimColumns}
        data={data?.items ?? []}
        empty="No claim sessions available."
      />
    </div>
  );
}
