import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import { DashboardTable } from "@/components/dashboard-ui";
import { subscriptionDeliveryEventColumns } from "@/features/notify/events/columns";
import {useNotifyEventsQuery, useNotifySubscriptionDetailQuery} from "@/features/notify/query";
import { useToastError } from "@/lib/toast-error";

export function SubscriptionDetailSheet({
  subscriptionId,
  onClose,
}: {
  subscriptionId: string;
  onClose: () => void;
}) {
  const historyPage = 1;
  const pageSize = 10;

  const detailQuery = useNotifySubscriptionDetailQuery(subscriptionId, {
    page: historyPage,
    pageSize,
  });

  const eventsQuery = useNotifyEventsQuery(subscriptionId);
  const detailData = detailQuery.data;

  useToastError(detailQuery.error, { title: "Failed to load subscription details" });

  const deliveryEvents = eventsQuery.data?.data ?? [];

  return (
    <Sheet
      open={subscriptionId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent className="w-full sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Subscription Details</SheetTitle>
          <SheetDescription>
            {detailData
              ? `${detailData.channel?.name ?? detailData.channelId} · ${detailData.topicType} / ${detailData.topicKey}`
              : "Subscription delivery details."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 overflow-y-auto px-8 pb-8">
          {detailData ? (
            <div className="space-y-6">
              <div className="grid gap-3 border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                <SubscriptionDetailItem
                  label="Channel"
                  value={detailData.channel?.name ?? detailData.channelId}
                />
                <SubscriptionDetailItem
                  label="Bot Runtime"
                  value={
                    detailData.botInstance?.displayName ?? detailData.botPluginInstanceId ?? "—"
                  }
                />
                <SubscriptionDetailItem
                  label="Connection"
                  value={detailData.connection?.providerAccountName ?? detailData.connectionId}
                />
                <SubscriptionDetailItem
                  label="Owner"
                  value={
                    detailData.owner?.name ??
                    detailData.ownerChannel?.name ??
                    detailData.ownerId
                  }
                />
                <SubscriptionDetailItem
                  label="Topic"
                  value={`${detailData.topicType} / ${detailData.topicKey}`}
                />
                <SubscriptionDetailItem label="Status" value={detailData.status} />
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
                  <Button onClick={() => void detailQuery.refetch()} variant="outline" size="sm">
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
