import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  timeColumn,
  codeColumn,
  type DataTableActionItem,
} from "@repo/data-table";

import { BotCredentialDialog } from "./dialogs";
import {
  deleteBotInstance,
  rotateBotInstanceCredential,
  updateBotInstance,
} from "@/features/bot-instances/api";
import { ConfirmDialog } from "@/features/common/confirm-dialog";
import { useModal } from "@/lib/modal";
import type { BotInstanceDto } from "@/api/modules/platform/bot-plugin/contract";

export const botInstanceColumns: ColumnDef<BotInstanceDto>[] = [
  objectColumn({
    id: "botName",
    header: "Name",
    title: (row) => row.name ?? "Unnamed Bot",
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
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [rotateOpen, setRotateOpen] = useState(false);
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
  const updateInstance = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "disabled" }) =>
      updateBotInstance(input.id, { status: input.status }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "bot-instances"] });
      toast.success("Bot instance updated", {
        description: `Bot instance ${data.id} is now ${data.status}.`,
      });
    },
  });
  const deleteInstance = useMutation({
    mutationFn: async (id: string) => deleteBotInstance(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "bot-instances"] });
      await queryClient.invalidateQueries({ queryKey: ["binding", "channel-bindings"] });
      await queryClient.invalidateQueries({ queryKey: ["notify", "subscriptions"] });
      toast.success("Bot instance deleted");
    },
  });
  const canManage = instance.canManage === true;
  const items: DataTableActionItem[] = canManage
    ? [
        {
          label: "Rotate",
          onSelect: () => setRotateOpen(true),
        },
        {
          label: instance.status === "active" ? "Disable" : "Enable",
          variant: "destructive",
          onSelect: () => {
            const status = instance.status === "active" ? "disabled" : "active";
            if (status === "disabled") {
              setConfirm({
                title: `Disable ${instance.name ?? instance.instanceKey}`,
                description:
                  "This stops runtime credential authentication and notification delivery for this bot instance.",
                onConfirm: () => updateInstance.mutate({ id: instance.id, status }),
              });
              return;
            }
            updateInstance.mutate({ id: instance.id, status });
          },
        },
        {
          label: "Delete",
          variant: "destructive",
          onSelect: () => {
            setConfirm({
              title: `Delete ${instance.name ?? instance.instanceKey}`,
              description:
                "This removes the bot instance from normal use and suspends related channel bindings asynchronously. Delivery history is retained.",
              onConfirm: () => deleteInstance.mutate(instance.id),
            });
          },
        },
      ]
    : [{ label: "View only", disabled: true }];

  return (
    <>
      <DataTableActions label={`Open actions for ${instance.name ?? instance.id}`} items={items} />
      <ConfirmDialog
        title="Rotate bot credential"
        description="The deployed plugin will stop working until it is updated with the new credential."
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        onConfirm={() => rotateCredential.mutate(instance.id)}
      />
      <ConfirmDialog
        title={confirm?.title ?? "Confirm action"}
        description={confirm?.description ?? "Confirm this operation."}
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </>
  );
}
