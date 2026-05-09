import type { ColumnDef } from "@tanstack/react-table";

import { objectColumn, statusColumn, timeColumn } from "@repo/data-table";

import type { ChannelBindingListItem } from "@/features/binding/api";

export const bindingChannelColumns: ColumnDef<ChannelBindingListItem>[] = [
  objectColumn({
    id: "botChannel",
    header: "Bot Channel",
    title: (row) => row.binding.externalChannelName ?? row.binding.externalChannelId,
  }),
  {
    id: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.binding.platform,
  },
  {
    id: "toriChannel",
    header: "Tori Channel",
    cell: ({ row }) => row.original.channel?.name ?? row.original.binding.channelId,
  },
  {
    id: "botInstance",
    header: "Bot Instance",
    cell: ({ row }) =>
      row.original.botInstance?.displayName ?? row.original.binding.botPluginInstanceId ?? "—",
  },
  statusColumn({
    id: "status",
    header: "Status",
    text: (row) => row.binding.status,
    tone: (row) => (row.binding.status === "active" ? "success" : "neutral"),
  }),
  timeColumn({
    id: "createdAt",
    header: "Mapped At",
    value: (row) => row.binding.createdAt,
  }),
];
