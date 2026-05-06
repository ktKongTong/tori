import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import { BotCredentialDialog } from "./dialogs";
import {
  revokeBotInstance,
  rotateBotInstanceCredential,
  type DashboardBotInstancesData,
} from "@/features/bot-instances/api";
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
    cell: ({ row }) => (
      <div className="space-y-1">
        <p>{row.original.deliveryEndpointLabel ?? "—"}</p>
        {row.original.deliveryEndpointKind ? (
          <DashboardStatusPill
            text={row.original.deliveryEndpointKind}
            tone={row.original.deliveryEndpointKind === "webhook" ? "success" : "warning"}
          />
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "credentialRotatedAt",
    header: "Credential",
    cell: ({ row }) => row.original.credentialRotatedAt ?? "—",
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
