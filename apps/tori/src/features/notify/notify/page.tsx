import { Button } from "@repo/ui/components/button";

import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { notifySubscriptionColumns } from "./columns";
import { SubscriptionDialog } from "./create-subscription-form";
import { useSession } from "@/lib/auth-client";
import { useModal } from "@/lib/modal";
import { useDashboardBindingQuery } from "@/features/binding/query";
import { useDashboardIntegrationQuery } from "@/features/integration/query";
import { useDashboardNotifySubscriptionsQuery } from "@/features/notify/query";
import { useToastError } from "@/lib/toast-error";

export function DashboardNotifyPage() {
  const modal = useModal();
  const { data: session } = useSession();
  const notifyQuery = useDashboardNotifySubscriptionsQuery();
  const notifyData = notifyQuery.data;

  const bindingQuery = useDashboardBindingQuery();
  const integrationQuery = useDashboardIntegrationQuery();
  const availableChannelBindings = bindingQuery.data?.channelBindings ?? [];
  const availableConnections =
    integrationQuery.data?.connections.filter((connection) => connection.status === "active") ?? [];

  useToastError(notifyQuery.error, { title: "Failed to load subscriptions" });

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button
          onClick={() => {
            if (session?.user?.id) {
              modal.open(
                <SubscriptionDialog
                  availableChannelBindings={availableChannelBindings}
                  availableConnections={availableConnections}
                  userId={session.user.id}
                />,
              );
            }
          }}
          disabled={!session?.user?.id}
        >
          Create Subscription
        </Button>
        <Button onClick={() => void notifyQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      <DashboardTable
        columns={notifySubscriptionColumns}
        data={notifyData?.subscriptions ?? []}
        empty="No subscriptions available."
      />
    </div>
  );
}
