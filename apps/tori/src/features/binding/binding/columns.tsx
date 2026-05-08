import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DashboardTableActions } from "@/components/dashboard-ui";
import { revokeUserBinding, type UserBindingListItem } from "@/features/binding/api";
import { useToastError } from "@/lib/toast-error";

export const bindingColumns: ColumnDef<UserBindingListItem>[] = [
  {
    accessorKey: "userName",
    header: "User Name",
    cell: ({ row }) => row.original.user?.name ?? row.original.binding.userId,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.binding.platform,
  },
  {
    accessorKey: "externalUserName",
    header: "External User Name",
    cell: ({ row }) => row.original.binding.externalUserName,
  },
  {
    accessorKey: "assurance",
    header: "Assurance",
    cell: ({ row }) => row.original.binding.assurance,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <BindingActions binding={row.original} />,
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
    <DashboardTableActions
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
