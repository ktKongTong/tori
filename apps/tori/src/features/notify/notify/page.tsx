import { useMemo, useState } from "react";
import { Button } from "@repo/ui/components/button";

import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { createNotifySubscriptionColumns, type NotifySubscriptionView } from "./columns";
import { SubscriptionDialog } from "./create-subscription-form";
import { SubscriptionDetailSheet } from "./detail-sheet";
import { useSession } from "@/lib/auth-client";
import { useModal } from "@/lib/modal";
import { useNotificationSubscriptionsQuery } from "@/features/notify/query";
import { useToastError } from "@/lib/toast-error";

export function NotifySubscriptionPage() {
  const modal = useModal();
  const { data: session } = useSession();
  const [selectedSubscription, setSelectedSubscription] = useState<NotifySubscriptionView | null>(
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

      <DashboardTable
        columns={columns}
        data={notifyData?.data ?? []}
        empty="No subscriptions available."
      />

      <SubscriptionDetailSheet
        subscriptionId={selectedSubscription?.id ?? null}
        onClose={() => setSelectedSubscription(null)}
      />
    </div>
  );
}
