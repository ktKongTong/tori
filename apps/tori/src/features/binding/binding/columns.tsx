import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  timeColumn,
  type DataTableStatusTone,
} from "@repo/data-table";

import { revokeUserBinding, type UserBindingListItem } from "@/features/binding/api";
import { useToastError } from "@/lib/toast-error";

export const bindingColumns: ColumnDef<UserBindingListItem>[] = [
  objectColumn({
    id: "botIdentity",
    header: "Bot Identity",
    title: (row) => row.binding.externalUserName ?? row.binding.externalUserId,
  }),
  {
    id: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.binding.platform,
  },
  statusColumn({
    id: "status",
    header: "Status",
    text: (row) => row.binding.status,
    tone: (row) => (row.binding.status === "active" ? "success" : "neutral"),
  }),
  {
    id: "assurance",
    header: "Assurance",
    cell: ({ row }) => row.original.binding.assurance,
  },
  timeColumn({
    id: "createdAt",
    header: "Mapped At",
    value: (row) => row.binding.createdAt,
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

  const bindingRow = binding.binding;
  const userName = binding.user?.name ?? bindingRow.userId;

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
