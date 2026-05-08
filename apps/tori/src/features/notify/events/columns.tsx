import type { ColumnDef } from "@tanstack/react-table";

import { DashboardStatusPill } from "@/components/dashboard-ui";
import type { NotificationEventDto } from "@/api/modules/platform/notify/contract";
import type { SubscriptionViewDto } from "@/api/modules/platform/subscription/contract";

type NotificationEventListItemDto = {
  event: NotificationEventDto;
  subscription: SubscriptionViewDto | null;
  channel: { id: string; name: string | null } | null;
  botInstance: { id: string; displayName: string | null } | null;
  endpoint: { id: string; displayName: string | null } | null;
};

const deliveryResultColumn: ColumnDef<NotificationEventListItemDto> = {
  accessorKey: "status",
  header: "Result",
  cell: ({ row }) => (
    <DashboardStatusPill
      text={row.original.event.status}
      tone={
        row.original.event.status === "sent"
          ? "success"
          : row.original.event.status === "failed"
            ? "danger"
            : "neutral"
      }
    />
  ),
};

const deliveryStateColumn: ColumnDef<NotificationEventListItemDto> = {
  id: "deliveryState",
  header: "Delivery",
  cell: ({ row }) => (
    <div className="max-w-md space-y-1 text-sm">
      {row.original.event.sentAt ? <p>Sent: {row.original.event.sentAt}</p> : null}
      {row.original.event.failedAt ? <p>Failed: {row.original.event.failedAt}</p> : null}
      {row.original.event.errorMessage ? (
        <p className="break-words text-destructive">{row.original.event.errorMessage}</p>
      ) : null}
      {!row.original.event.sentAt &&
      !row.original.event.failedAt &&
      !row.original.event.errorMessage
        ? "—"
        : null}
    </div>
  ),
};

export const notifyEventColumns: ColumnDef<NotificationEventListItemDto>[] = [
  {
    accessorKey: "subscription",
    header: "Subscription",
    cell: ({ row }) =>
      row.original.subscription
        ? `${row.original.subscription.topicType} / ${row.original.subscription.topicKey}`
        : "—",
  },
  {
    accessorKey: "channel",
    header: "Channel",
    cell: ({ row }) => row.original.channel?.name ?? row.original.event.channelId,
  },
  {
    accessorKey: "botInstance",
    header: "Bot Instance",
    cell: ({ row }) =>
      row.original.botInstance?.displayName ?? row.original.event.botPluginInstanceId ?? "—",
  },
  {
    accessorKey: "deliveryEndpoint",
    header: "Endpoint",
    cell: ({ row }) =>
      row.original.endpoint?.displayName ?? row.original.event.deliveryEndpointId ?? "—",
  },
  deliveryResultColumn,
  deliveryStateColumn,
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => row.original.event.createdAt,
  },
];

export const subscriptionDeliveryEventColumns: ColumnDef<NotificationEventDto>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => row.original.title ?? "Notification",
  },
  {
    accessorKey: "status",
    header: "Result",
    cell: ({ row }) => (
      <DashboardStatusPill
        text={row.original.status}
        tone={
          row.original.status === "sent"
            ? "success"
            : row.original.status === "failed"
              ? "danger"
              : "neutral"
        }
      />
    ),
  },
  {
    accessorKey: "deliveryEndpoint",
    header: "Endpoint",
    cell: ({ row }) => row.original.deliveryEndpointId ?? "—",
  },
  {
    id: "deliveryState",
    header: "Delivery",
    cell: ({ row }) => (
      <div className="max-w-md space-y-1 text-sm">
        {row.original.sentAt ? <p>Sent: {row.original.sentAt}</p> : null}
        {row.original.failedAt ? <p>Failed: {row.original.failedAt}</p> : null}
        {row.original.errorMessage ? (
          <p className="break-words text-destructive">{row.original.errorMessage}</p>
        ) : null}
        {!row.original.sentAt && !row.original.failedAt && !row.original.errorMessage ? "—" : null}
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => row.original.createdAt,
  },
];
