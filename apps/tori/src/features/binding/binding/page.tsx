import { Button } from "@repo/ui/components/button";

import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { useModal } from "@/lib/modal";
import { bindingColumns } from "./columns";
import { RedeemTokenDialog } from "./redeem-token-dialog";
import { useUserBindingsQuery } from "@/features/binding/query";
import { useToastError } from "@/lib/toast-error";

export function BindingPage() {
  const modal = useModal();
  const bindingQuery = useUserBindingsQuery();
  const data = bindingQuery.data;

  useToastError(bindingQuery.error, { title: "Failed to load bindings" });

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => modal.open(<RedeemTokenDialog />)}>Redeem Token</Button>
      </DashboardActionBar>

      <DashboardTable
        columns={bindingColumns}
        data={data?.items ?? []}
        empty="No completed user bindings available."
      />
    </div>
  );
}
