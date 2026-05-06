import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DashboardTableActions } from "@/components/dashboard-ui";
import { revokeUserBinding, type DashboardBindingData } from "@/features/binding/api";
import { useToastError } from "@/lib/toast-error";

export type BindingRow = DashboardBindingData["userBindings"][number];

export const bindingColumns: ColumnDef<BindingRow>[] = [
  {
    accessorKey: "userName",
    header: "User Name",
    cell: ({ row }) => row.original.userName,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.platform,
  },
  {
    accessorKey: "externalUserName",
    header: "External User Name",
    cell: ({ row }) => row.original.externalUserName,
  },
  {
    accessorKey: "assurance",
    header: "Assurance",
    cell: ({ row }) => row.original.assurance,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <BindingActions binding={row.original} />,
  },
];

function BindingActions({ binding }: { binding: BindingRow }) {
  const queryClient = useQueryClient();
  const removeBinding = useMutation({
    mutationFn: async (bindingId: string) => revokeUserBinding(bindingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "binding"],
      });
    },
  });

  useToastError(removeBinding.error, { title: "Failed to remove binding" });

  return (
    <DashboardTableActions
      label={`Open actions for ${binding.userName}`}
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
