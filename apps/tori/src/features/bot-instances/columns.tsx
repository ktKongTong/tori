import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import { AttachDeliveryEndpointDialog } from "./dialogs";
import {
  revokeBotInstance,
  rotateBotInstanceCredential,
  type DashboardBotInstancesData,
} from "@/features/bot-instances/api";
import { useDashboardBotInstancesQuery } from "@/features/bot-instances/query";
import { useModal } from "@/lib/modal";

export type BotInstanceRow = DashboardBotInstancesData["instances"][number];

export const botInstanceColumns: ColumnDef<BotInstanceRow>[] = [
  {
    accessorKey: "displayName",
    header: "Name",
    cell: ({ row }) => row.original.displayName,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.platform,
  },
  {
    accessorKey: "namespace",
    header: "Namespace",
    cell: ({ row }) => row.original.namespace,
  },
  {
    accessorKey: "deliveryEndpointLabel",
    header: "Endpoint",
    cell: ({ row }) => row.original.deliveryEndpointLabel ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <DashboardStatusPill text={row.original.status} />,
  },
  {
    accessorKey: "lastSeenAt",
    header: "Last Seen",
    cell: ({ row }) => row.original.lastSeenAt ?? "—",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <BotInstanceActions instance={row.original} />,
  },
];

function BotInstanceActions({ instance }: { instance: BotInstanceRow }) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const botInstancesQuery = useDashboardBotInstancesQuery();
  const rotateCredential = useMutation({
    mutationFn: async (id: string) => rotateBotInstanceCredential(id),
    onSuccess: (data) => {
      toast.success("Credential rotated", {
        description: `Rotated credential for ${data.id}: ${data.plaintextCredential}`,
      });
    },
  });
  const revokeInstance = useMutation({
    mutationFn: async (id: string) => revokeBotInstance(id),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "bot-instances"] });
      toast.success("Bot instance updated", {
        description: `Bot instance ${data.id} is now ${data.status}.`,
      });
    },
  });

  return (
    <DashboardTableActions
      label={`Open actions for ${instance.displayName}`}
      items={[
        {
          label: "Rotate",
          onSelect: () => rotateCredential.mutate(instance.id),
        },
        {
          label: "Attach Endpoint",
          onSelect: () => {
            modal.open(
              <AttachDeliveryEndpointDialog
                defaultEndpointId={instance.deliveryEndpointId}
                deliveryEndpoints={botInstancesQuery.data?.deliveryEndpoints ?? []}
                instanceId={instance.id}
              />,
            );
          },
        },
        {
          label: "Revoke",
          variant: "destructive",
          onSelect: () => revokeInstance.mutate(instance.id),
        },
      ]}
    />
  );
}
