import type { ColumnDef } from "@tanstack/react-table";

import { DashboardStatusPill } from "@/components/dashboard-ui";
import type { DashboardNotifyEventsData } from "@/features/notify/api";

export type NotifyEventRow = DashboardNotifyEventsData["notificationEvents"][number];

const deliveryResultColumn: ColumnDef<NotifyEventRow> = {
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
};

const deliveryStateColumn: ColumnDef<NotifyEventRow> = {
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
};

export const notifyEventColumns: ColumnDef<NotifyEventRow>[] = [
  {
    accessorKey: "subscriptionLabel",
    header: "Subscription",
    cell: ({ row }) => row.original.subscriptionLabel ?? "—",
  },
  {
    accessorKey: "channelLabel",
    header: "Channel Binding",
    cell: ({ row }) => row.original.channelLabel,
  },
  {
    accessorKey: "botPluginInstanceLabel",
    header: "Bot Runtime",
    cell: ({ row }) => row.original.botPluginInstanceLabel ?? "—",
  },
  {
    accessorKey: "deliveryEndpointLabel",
    header: "Endpoint",
    cell: ({ row }) => row.original.deliveryEndpointLabel ?? "—",
  },
  deliveryResultColumn,
  deliveryStateColumn,
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => row.original.createdAt,
  },
];

export const subscriptionDeliveryEventColumns: ColumnDef<NotifyEventRow>[] = [
  {
    accessorKey: "title",
    header: "Event",
    cell: ({ row }) => row.original.title ?? "Notification",
  },
  deliveryResultColumn,
  {
    accessorKey: "deliveryEndpointLabel",
    header: "Endpoint",
    cell: ({ row }) => row.original.deliveryEndpointLabel ?? "—",
  },
  deliveryStateColumn,
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => row.original.createdAt,
  },
];
