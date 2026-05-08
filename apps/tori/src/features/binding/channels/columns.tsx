import type { ColumnDef } from "@tanstack/react-table";

import type { ChannelBindingListItem } from "@/features/binding/api";

export const bindingChannelColumns: ColumnDef<ChannelBindingListItem>[] = [
  {
    accessorKey: "channelName",
    header: "Channel Name",
    cell: ({ row }) => row.original.channel?.name ?? row.original.binding.channelId,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.binding.platform,
  },
  {
    accessorKey: "externalChannelName",
    header: "External Channel Name",
    cell: ({ row }) => row.original.binding.externalChannelName,
  },
  {
    accessorKey: "botInstanceName",
    header: "Bot Instance",
    cell: ({ row }) =>
      row.original.botInstance?.displayName ?? row.original.binding.botPluginInstanceId,
  },
];
