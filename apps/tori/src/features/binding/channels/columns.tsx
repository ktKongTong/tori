import type { ColumnDef } from "@tanstack/react-table";

import type { DashboardBindingData } from "@/features/binding/api";

export type BindingChannelRow = DashboardBindingData["channelBindings"][number];

export const bindingChannelColumns: ColumnDef<BindingChannelRow>[] = [
  {
    accessorKey: "channelName",
    header: "Channel Name",
    cell: ({ row }) => row.original.channelName,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.platform,
  },
  {
    accessorKey: "externalChannelName",
    header: "External Channel Name",
    cell: ({ row }) => row.original.externalChannelName,
  },
  {
    accessorKey: "botInstanceName",
    header: "Bot Instance",
    cell: ({ row }) => row.original.botInstanceName,
  },
];
