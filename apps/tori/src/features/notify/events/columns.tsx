import type { ColumnDef } from "@tanstack/react-table";

import { objectColumn, statusColumn, timeColumn, type DataTableStatusTone } from "@repo/data-table";
import type { NotificationEventDto } from "@/api/modules/platform/notify/contract";
import type { SubscriptionViewDto } from "@/api/modules/platform/subscription/contract";

type NotificationEventListItemDto = {
  event: NotificationEventDto;
  subscription: SubscriptionViewDto | null;
  channel: { id: string; name: string | null } | null;
  botInstance: { id: string; displayName: string | null } | null;
  endpoint: { id: string; displayName: string | null } | null;
};

export const notifyEventColumns: ColumnDef<NotificationEventListItemDto>[] = [
  objectColumn({
    id: "title",
    header: "Event",
    title: (row) => row.event.title ?? "Notification",
  }),
  {
    id: "subscription",
    header: "Subscription",
    cell: ({ row }) =>
      row.original.subscription
        ? `${row.original.subscription.topicType} / ${row.original.subscription.topicKey}`
        : "—",
  },
  {
    id: "channel",
    header: "Channel",
    cell: ({ row }) => row.original.channel?.name ?? row.original.event.channelId,
  },
  {
    id: "botInstance",
    header: "Bot Instance",
    cell: ({ row }) =>
      row.original.botInstance?.displayName ?? row.original.event.botPluginInstanceId ?? "—",
  },
  {
    id: "deliveryEndpoint",
    header: "Endpoint",
    cell: ({ row }) =>
      row.original.endpoint?.displayName ?? row.original.event.deliveryEndpointId ?? "—",
  },
  statusColumn({
    id: "status",
    header: "Result",
    text: (row) => row.event.status,
    tone: (row): DataTableStatusTone => {
      if (row.event.status === "sent") return "success";
      if (row.event.status === "failed") return "danger";
      return "neutral";
    },
    detail: (row) => row.event.errorMessage ?? null,
  }),
  timeColumn({
    id: "createdAt",
    header: "Created At",
    value: (row) => row.event.createdAt,
  }),
];

export const subscriptionDeliveryEventColumns: ColumnDef<NotificationEventDto>[] = [
  objectColumn({
    id: "title",
    header: "Event",
    title: (row) => row.title ?? "Notification",
  }),
  {
    id: "deliveryEndpoint",
    header: "Endpoint",
    cell: ({ row }) => row.original.deliveryEndpointId ?? "—",
  },
  statusColumn({
    id: "status",
    header: "Result",
    text: (row) => row.status,
    tone: (row): DataTableStatusTone => {
      if (row.status === "sent") return "success";
      if (row.status === "failed") return "danger";
      return "neutral";
    },
    detail: (row) => row.errorMessage ?? null,
  }),
  timeColumn({
    id: "createdAt",
    header: "Created At",
    value: (row) => row.createdAt,
  }),
];
