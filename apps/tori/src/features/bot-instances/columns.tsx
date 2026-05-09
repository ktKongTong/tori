import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  timeColumn,
  codeColumn,
} from "@repo/data-table";

import { BotCredentialDialog } from "./dialogs";
import { revokeBotInstance, rotateBotInstanceCredential } from "@/features/bot-instances/api";
import { useModal } from "@/lib/modal";
import type { BotInstanceDto } from "@/api/modules/platform/bot-plugin/contract";

export const botInstanceColumns: ColumnDef<BotInstanceDto>[] = [
  objectColumn({
    id: "botName",
    header: "Name",
    title: (row) => row.displayName ?? "Unnamed Bot",
  }),
  {
    id: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.platform,
  },
  {
    id: "namespace",
    header: "Namespace",
    cell: ({ row }) => row.original.namespace,
  },
  codeColumn({
    id: "endpointId",
    header: "Endpoint ID",
    value: (row) => row.deliveryEndpointId,
    copyable: true,
    empty: "—",
  }),
  statusColumn({
    id: "status",
    header: "Status",
    text: (row) => row.status,
    tone: (row) => (row.status === "active" ? "success" : "neutral"),
  }),
  timeColumn({
    id: "lastSeenAt",
    header: "Last Seen",
    value: (row) => row.lastSeenAt,
  }),
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <BotInstanceActions instance={row.original} />,
    meta: {
      kind: "actions",
      priority: "secondary",
      align: "right",
    },
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
    <DataTableActions
      label={`Open actions for ${instance.displayName ?? instance.id}`}
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
