import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { useState } from "react";
import { DataTable } from "@repo/data-table";
import { IconArrowRight, IconBolt, IconMapPin, IconSend } from "@tabler/icons-react";

import { DashboardPagination } from "@/components/dashboard-ui";
import { subscriptionDeliveryEventColumns } from "@/features/notify/events/columns";
import { useNotifyEventsQuery, useNotifySubscriptionDetailQuery } from "@/features/notify/query";
import { useToastError } from "@/lib/toast-error";

export function SubscriptionDetailSheet({
  subscriptionId,
  onClose,
}: {
  subscriptionId: string;
  onClose: () => void;
}) {
  const pageSize = 10;
  const [historyPage, setHistoryPage] = useState(1);

  const detailQuery = useNotifySubscriptionDetailQuery(subscriptionId);
  const eventsQuery = useNotifyEventsQuery(subscriptionId, { page: historyPage, pageSize });
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
          <SheetTitle>Subscription Data Flow</SheetTitle>
          <SheetDescription>
            Visualizing how notifications are triggered and delivered.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 overflow-y-auto px-8 pb-8 pt-8">
          {detailData ? (
            <div className="space-y-12">
              {/* Data Flow Visualization */}
              <div className="relative flex flex-col items-center justify-between gap-8 md:flex-row md:items-stretch">
                <FlowCard
                  icon={<IconBolt className="size-4" />}
                  label="Trigger Source"
                  title={detailData.topicType}
                  description={detailData.connection?.providerAccountName ?? "System Task"}
                />
                <FlowArrow />
                <FlowCard
                  icon={<IconSend className="size-4" />}
                  label="Destination"
                  title={detailData.channel?.name ?? "Unknown Channel"}
                  description={detailData.channelId ?? "—"}
                />
                <FlowArrow />
                <FlowCard
                  icon={<IconMapPin className="size-4" />}
                  label="Fan-out Routes"
                  title="Channel Bindings"
                  description="Resolved per delivery attempt"
                />
              </div>

              <div className="grid gap-6 border-t pt-8 text-sm sm:grid-cols-2">
                <DetailItem label="Status" value={detailData.status} />
                <DetailItem
                  label="Created At"
                  value={new Date(detailData.createdAt).toLocaleString()}
                />
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase mb-2">
                    Event Types
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detailData.eventTypes.map((type) => (
                      <span key={type} className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm font-semibold tracking-[0.16em] uppercase">
                      Recent Delivery History
                    </p>
                  </div>
                  <Button onClick={() => void eventsQuery.refetch()} variant="outline" size="sm">
                    Refresh
                  </Button>
                </div>

                <DataTable
                  columns={subscriptionDeliveryEventColumns}
                  data={deliveryEvents}
                  empty={{
                    title: "No delivery attempts",
                    description: "No events have been triggered for this subscription yet.",
                  }}
                />
                <DashboardPagination
                  page={eventsQuery.data?.page.page ?? 1}
                  pageSize={eventsQuery.data?.page.pageSize ?? pageSize}
                  total={eventsQuery.data?.page.total ?? 0}
                  totalPages={eventsQuery.data?.page.totalPages ?? 0}
                  onPageChange={setHistoryPage}
                />
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FlowCard({
  icon,
  label,
  title,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">{label}</span>
      </div>
      <div className="mt-1">
        <p className="font-semibold text-sm truncate" title={title}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground truncate" title={description}>
          {description}
        </p>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center opacity-30">
      <IconArrowRight className="hidden size-5 md:block" />
      {/* Down arrow for mobile could be added here */}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 break-words text-foreground">{value}</p>
    </div>
  );
}
