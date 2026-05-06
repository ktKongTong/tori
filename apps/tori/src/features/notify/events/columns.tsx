import type { ColumnDef } from "@tanstack/react-table";

import { DashboardStatusPill } from "@/components/dashboard-ui";
import type { DashboardNotifyEventsData } from "@/features/notify/api";

export type NotifyEventRow = DashboardNotifyEventsData["notificationEvents"][number];

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
    accessorKey: "status",
    header: "Result",
    cell: ({ row }) => <DashboardStatusPill text={row.original.status} />,
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
    cell: ({ row }) => row.original.createdAt,
  },
];
