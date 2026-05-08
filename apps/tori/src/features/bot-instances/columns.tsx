import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import { BotCredentialDialog } from "./dialogs";
import { revokeBotInstance, rotateBotInstanceCredential } from "@/features/bot-instances/api";
import { useModal } from "@/lib/modal";
import type { BotInstanceDto } from "@/api/modules/platform/bot-plugin/contract";

export const botInstanceColumns: ColumnDef<BotInstanceDto>[] = [
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
    accessorKey: "deliveryEndpointId",
    header: "Endpoint ID",
    cell: ({ row }) => row.original.deliveryEndpointId ?? "—",
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

function BotInstanceActions({ instance }: { instance: BotInstanceDto }) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const rotateCredential = useMutation({
    mutationFn: async (id: string) => rotateBotInstanceCredential(id),
    onSuccess: (data) => {
      modal.open(
        <BotCredentialDialog
          title="Bot Credential Rotated"
          description="The previous credential is no longer valid. Update the deployed plugin with this value."
          instanceId={data.id}
          plaintextCredential={data.plaintextCredential}
        />,
      );
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
          onSelect: () => {
            if (
              window.confirm(
                "Rotate this bot credential? The deployed plugin will stop working until it is updated.",
              )
            ) {
              rotateCredential.mutate(instance.id);
            }
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
