import { useMemo, useState } from "react";
import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import { DashboardActionBar, DashboardTable } from "@/components/dashboard-ui";
import { subscriptionDeliveryEventColumns } from "@/features/notify/events/columns";
import { createNotifySubscriptionColumns, type NotifySubscriptionRow } from "./columns";
import { SubscriptionDialog } from "./create-subscription-form";
import { useSession } from "@/lib/auth-client";
import { useModal } from "@/lib/modal";
import { useDashboardBindingQuery } from "@/features/binding/query";
import { useDashboardIntegrationQuery } from "@/features/integration/query";
import {
  useDashboardNotifyEventsQuery,
  useDashboardNotifySubscriptionsQuery,
} from "@/features/notify/query";
import { useToastError } from "@/lib/toast-error";

export function DashboardNotifyPage() {
  const modal = useModal();
  const { data: session } = useSession();
  const [selectedSubscription, setSelectedSubscription] = useState<NotifySubscriptionRow | null>(
    null,
  );
  const notifyQuery = useDashboardNotifySubscriptionsQuery();
  const eventsQuery = useDashboardNotifyEventsQuery();
  const notifyData = notifyQuery.data;
  const notificationEvents = eventsQuery.data?.notificationEvents ?? [];

  const bindingQuery = useDashboardBindingQuery();
  const integrationQuery = useDashboardIntegrationQuery();
  const availableChannelBindings = bindingQuery.data?.channelBindings ?? [];
  const availableConnections =
    integrationQuery.data?.connections.filter((connection) => connection.status === "active") ?? [];
  const columns = useMemo(
    () => createNotifySubscriptionColumns({ onOpenDetails: setSelectedSubscription }),
    [],
  );
  const deliveryEvents = useMemo(
    () =>
      selectedSubscription
        ? notificationEvents.filter((event) => event.subscriptionId === selectedSubscription.id)
        : [],
    [notificationEvents, selectedSubscription],
  );

  useToastError(notifyQuery.error, { title: "Failed to load subscriptions" });
  useToastError(eventsQuery.error, { title: "Failed to load delivery history" });

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
        columns={columns}
        data={notifyData?.subscriptions ?? []}
        empty="No subscriptions available."
      />

      <Sheet
        open={selectedSubscription !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSubscription(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>Subscription Details</SheetTitle>
            <SheetDescription>
              {selectedSubscription
                ? `${selectedSubscription.channelLabel} · ${selectedSubscription.topicType} / ${selectedSubscription.topicKey}`
                : "Subscription delivery details."}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 overflow-y-auto px-8 pb-8">
            {selectedSubscription ? (
              <div className="space-y-6">
                <div className="grid gap-3 border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                  <SubscriptionDetailItem
                    label="Channel"
                    value={selectedSubscription.channelLabel}
                  />
                  <SubscriptionDetailItem
                    label="Bot Runtime"
                    value={selectedSubscription.botPluginInstanceLabel}
                  />
                  <SubscriptionDetailItem
                    label="Connection"
                    value={selectedSubscription.connectionLabel}
                  />
                  <SubscriptionDetailItem label="Owner" value={selectedSubscription.ownerLabel} />
                  <SubscriptionDetailItem
                    label="Topic"
                    value={`${selectedSubscription.topicType} / ${selectedSubscription.topicKey}`}
                  />
                  <SubscriptionDetailItem label="Status" value={selectedSubscription.status} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-heading text-sm font-semibold tracking-[0.16em] uppercase">
                        Delivery History
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Recent delivery attempts for this subscription.
                      </p>
                    </div>
                    <Button onClick={() => void eventsQuery.refetch()} variant="outline" size="sm">
                      Refresh
                    </Button>
                  </div>

                  <DashboardTable
                    columns={subscriptionDeliveryEventColumns}
                    data={deliveryEvents}
                    empty="No delivery events for this subscription."
                  />
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SubscriptionDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 break-words text-foreground">{value}</p>
    </div>
  );
}
