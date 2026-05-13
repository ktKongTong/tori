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
  checkBotInstanceAction,
  deleteBotInstance,
  rotateBotInstanceCredential,
  updateBotInstance,
} from "@/features/bot-instances/api";
import { ActionImpactDialog, ConfirmDialog } from "@/features/action-check/confirm-dialog";
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
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof checkBotInstanceAction>> | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
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
            void (async () => {
              const status = instance.status === "active" ? "disabled" : "active";
              if (status === "disabled") {
                const nextImpact = await checkBotInstanceAction({
                  id: instance.id,
                  action: "disable",
                });
                setImpact(nextImpact);
                setPendingAction(() => () => updateInstance.mutate({ id: instance.id, status }));
                return;
              }
              updateInstance.mutate({ id: instance.id, status });
            })();
          },
        },
        {
          label: "Delete",
          variant: "destructive",
          onSelect: () => {
            void (async () => {
              const nextImpact = await checkBotInstanceAction({
                id: instance.id,
                action: "delete",
              });
              setImpact(nextImpact);
              setPendingAction(() => () => deleteInstance.mutate(instance.id));
            })();
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
      <ActionImpactDialog
        impact={impact}
        open={Boolean(impact)}
        onOpenChange={(open) => {
          if (!open) setImpact(null);
        }}
        onConfirm={() => {
          pendingAction?.();
          setPendingAction(null);
        }}
      />
    </>
  );
}
