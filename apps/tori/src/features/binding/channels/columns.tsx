import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DataTableActions, objectColumn, statusColumn, timeColumn } from "@repo/data-table";

import { deleteChannelBinding, type ChannelBindingListItem } from "@/features/binding/api";
import { useToastError } from "@/lib/toast-error";

export const bindingChannelColumns: ColumnDef<ChannelBindingListItem>[] = [
  objectColumn({
    id: "botChannel",
    header: "External Channel",
    title: (row) => row.externalChannelName ?? row.externalChannelId,
  }),
  {
    id: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.platform,
  },
  {
    id: "toriChannel",
    header: "Tori Channel",
    cell: ({ row }) => {
      const binding = row.original;
      return (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {binding.channel?.name ?? binding.channel?.type ?? "Unnamed channel"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {binding.channel?.id ?? binding.channelId}
          </p>
        </div>
      );
    },
  },
  {
    id: "botInstance",
    header: "Bot Instance",
    cell: ({ row }) => {
      const binding = row.original;
      const instance = binding.botInstance;
      if (!instance) return <span className="text-muted-foreground">—</span>;

      return (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {instance.name ?? instance.instanceKey}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {instance.platform}
            {instance.namespace ? ` / ${instance.namespace}` : ""}
          </p>
        </div>
      );
    },
  },
  statusColumn({
    id: "status",
    header: "Status",
    text: (row) => row.status,
    tone: (row) => (row.status === "active" ? "success" : "neutral"),
  }),
  timeColumn({
    id: "createdAt",
    header: "Mapped At",
    value: (row) => row.createdAt,
  }),
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <ChannelBindingActions binding={row.original} />,
    meta: {
      kind: "actions",
      priority: "secondary",
      align: "right",
    },
  },
];

function ChannelBindingActions({ binding }: { binding: ChannelBindingListItem }) {
  const queryClient = useQueryClient();
  const removeBinding = useMutation({
    mutationFn: async (bindingId: string) => deleteChannelBinding(bindingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["binding", "channel-bindings"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["notify", "subscriptions"],
      });
    },
  });

  useToastError(removeBinding.error, { title: "Failed to remove channel binding" });

  const label = binding.externalChannelName ?? binding.externalChannelId;

  return (
    <DataTableActions
      label={`Open actions for ${label}`}
      items={[
        {
          label: "Remove",
          variant: "destructive",
          onSelect: () => removeBinding.mutate(binding.id),
        },
      ]}
    />
  );
}
