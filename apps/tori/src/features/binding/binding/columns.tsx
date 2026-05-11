import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DataTableActions, objectColumn, statusColumn, timeColumn } from "@repo/data-table";

import { revokeUserBinding, type UserBindingListItem } from "@/features/binding/api";
import { useToastError } from "@/lib/toast-error";

export const bindingColumns: ColumnDef<UserBindingListItem>[] = [
  objectColumn({
    id: "botIdentity",
    header: "Bot Identity",
    title: (row) => row.externalUserName ?? row.externalUserId,
  }),
  {
    id: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.platform,
  },
  statusColumn({
    id: "status",
    header: "Status",
    text: (row) => row.status,
    tone: (row) => (row.status === "active" ? "success" : "neutral"),
  }),
  {
    id: "assurance",
    header: "Assurance",
    cell: ({ row }) => row.original.assurance,
  },
  timeColumn({
    id: "createdAt",
    header: "Mapped At",
    value: (row) => row.createdAt,
  }),
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <BindingActions binding={row.original} />,
    meta: {
      kind: "actions",
      priority: "secondary",
      align: "right",
    },
  },
];

function BindingActions({ binding }: { binding: UserBindingListItem }) {
  const queryClient = useQueryClient();
  const removeBinding = useMutation({
    mutationFn: async (bindingId: string) => revokeUserBinding(bindingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["binding", "user-bindings"],
      });
    },
  });

  useToastError(removeBinding.error, { title: "Failed to remove binding" });

  const bindingRow = binding;
  const userName = bindingRow.userId;

  return (
    <DataTableActions
      label={`Open actions for ${userName}`}
      items={[
        {
          label: "Remove",
          variant: "destructive",
          onSelect: () => removeBinding.mutate(bindingRow.id),
        },
      ]}
    />
  );
}
