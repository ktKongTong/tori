import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import { DeliveryEndpointDialog } from "./create-endpoint-form";
import {
  updateDeliveryEndpointStatus,
  type DashboardNotifyEndpointsData,
} from "@/features/notify/api";
import { useModal } from "@/lib/modal";

export type NotifyEndpointRow = DashboardNotifyEndpointsData["deliveryEndpoints"][number];

export const notifyEndpointColumns: ColumnDef<NotifyEndpointRow>[] = [
  {
    accessorKey: "displayName",
    header: "Display Name",
    cell: ({ row }) => row.original.displayName,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.platform,
  },
  {
    accessorKey: "kind",
    header: "Kind",
    cell: ({ row }) => row.original.kind,
  },
  {
    accessorKey: "target",
    header: "Target",
    cell: ({ row }) => row.original.target,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <DashboardStatusPill text={row.original.status} />,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <NotifyEndpointActions endpoint={row.original} />,
  },
];

function NotifyEndpointActions({ endpoint }: { endpoint: NotifyEndpointRow }) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const updateEndpointStatus = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "disabled" }) =>
      updateDeliveryEndpointStatus(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "notify", "delivery-endpoints"],
      });
      toast.success("Endpoint updated", {
        description: `Delivery endpoint ${data.id} is now ${data.status}.`,
      });
    },
  });

  return (
    <DashboardTableActions
      label={`Open actions for ${endpoint.displayName}`}
      items={[
        {
          label: "Reuse",
          onSelect: () => {
            modal.open(
              <DeliveryEndpointDialog
                defaultValues={{
                  platform: endpoint.platform,
                  kind: endpoint.kind,
                  target: endpoint.target,
                  displayName: endpoint.displayName,
                  secret: "",
                  config: "{}",
                }}
              />,
            );
          },
        },
        {
          label: endpoint.status === "active" ? "Disable" : "Enable",
          variant: endpoint.status === "active" ? "destructive" : "default",
          onSelect: () =>
            updateEndpointStatus.mutate({
              id: endpoint.id,
              status: endpoint.status === "active" ? "disabled" : "active",
            }),
        },
      ]}
    />
  );
}
