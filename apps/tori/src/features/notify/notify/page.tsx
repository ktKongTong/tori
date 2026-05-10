import { useMemo, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { DataTable } from "@repo/data-table";

import { DashboardActionBar } from "@/components/dashboard-ui";
import { createNotifySubscriptionColumns } from "./columns";
import { SubscriptionDialog } from "./create-subscription-form";
import { SubscriptionDetailSheet } from "./detail-sheet";
import { useSession } from "@/lib/auth-client";
import { useModal } from "@/lib/modal";
import { useNotificationSubscriptionsQuery } from "@/features/notify/query";
import { useToastError } from "@/lib/toast-error";
import type { SubscriptionViewDto } from "@/api/modules/platform/subscription/contract";

export function NotifySubscriptionPage() {
  const modal = useModal();
  const { data: session } = useSession();
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionViewDto | null>(
    null,
  );
  const notifyQuery = useNotificationSubscriptionsQuery();
  const notifyData = notifyQuery.data;

  const columns = useMemo(
    () => createNotifySubscriptionColumns({ onOpenDetails: setSelectedSubscription }),
    [],
  );

  useToastError(notifyQuery.error, { title: "Failed to load subscriptions" });

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button
          onClick={() => {
            if (session?.user?.id) {
              modal.open(<SubscriptionDialog userId={session.user.id} />);
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

      <DataTable
        columns={columns}
        data={notifyData?.data ?? []}
        isLoading={notifyQuery.isLoading}
        error={notifyQuery.error}
        onRetry={() => void notifyQuery.refetch()}
        empty={{
          title: "No subscriptions available",
          description: "You have not subscribed to any events yet.",
          action: (
            <Button
              onClick={() => {
                if (session?.user?.id) {
                  modal.open(<SubscriptionDialog userId={session.user.id} />);
                }
              }}
              variant="outline"
              disabled={!session?.user?.id}
            >
              Create your first Subscription
            </Button>
          ),
        }}
      />

      {selectedSubscription ? (
        <SubscriptionDetailSheet
          subscriptionId={selectedSubscription.id}
          onClose={() => setSelectedSubscription(null)}
        />
      ) : null}
    </div>
  );
}
