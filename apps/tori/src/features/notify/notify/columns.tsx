import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  timeColumn,
  type DataTableStatusTone,
} from "@repo/data-table";

import { SubscriptionDialog } from "./create-subscription-form";
import { updateSubscriptionStatus as updateSubscriptionStatusRequest } from "@/features/notify/api";
import { useModal } from "@/lib/modal";
import { useSession } from "@/lib/auth-client";
import { useToastError } from "@/lib/toast-error";
import type { SubscriptionViewDto } from "@/api/modules/platform/notification/subscription/contract";

function getSubscriptionTargetLabel(topicType: string) {
  if (topicType.includes("family")) return "Steam Family Library";
  if (topicType.includes("inventory")) return "Steam Inventory";
  return "Unknown Target";
}

export function createNotifySubscriptionColumns(input: {
  onOpenDetails: (subscription: SubscriptionViewDto) => void;
}): ColumnDef<SubscriptionViewDto>[] {
  return [
    objectColumn({
      id: "target",
      header: "Subscription Target",
      title: (row) => getSubscriptionTargetLabel(row.topicType),
      onOpen: input.onOpenDetails,
    }),
    {
      id: "account",
      header: "Account",
      cell: ({ row }) =>
        row.original.connection?.providerAccountName ??
        row.original.connection?.provider ??
        "Unknown Account",
    },
    {
      id: "events",
      header: "Events",
      cell: ({ row }) =>
        row.original.eventTypes.length === 1
          ? row.original.eventTypes[0]
          : `${row.original.eventTypes.length} events`,
    },
    {
      accessorKey: "channel",
      header: "Delivery Channel",
      cell: ({ row }) => row.original.channel?.name ?? "Unknown Channel",
    },
    statusColumn({
      id: "status",
      header: "Status",
      text: (row) => row.status,
      tone: (row): DataTableStatusTone => {
        if (row.status === "active") return "success";
        if (row.status === "disabled") return "neutral";
        return "danger";
      },
      detail: (row) => {
        if (row.status === "disabled") return "This subscription is currently disabled.";
        return null;
      },
    }),
    timeColumn({
      id: "updatedAt",
      header: "Last Updated",
      value: (row) => row.updatedAt,
      empty: "Never",
    }),
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <NotifySubscriptionActions
          onOpenDetails={input.onOpenDetails}
          subscription={row.original}
        />
      ),
      meta: {
        kind: "actions",
        priority: "secondary",
        align: "right",
      },
    },
  ];
}

function NotifySubscriptionActions({
  onOpenDetails,
  subscription,
}: {
  onOpenDetails: (subscription: SubscriptionViewDto) => void;
  subscription: SubscriptionViewDto;
}) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const updateSubscriptionStatus = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "disabled" }) =>
      updateSubscriptionStatusRequest(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["notify", "subscriptions"] });
      toast.success("Subscription updated", {
        description: `Subscription ${data.id} is now ${data.status}.`,
      });
    },
  });

  useToastError(updateSubscriptionStatus.error, { title: "Failed to update subscription" });

  const channelName = subscription.channel?.name ?? "Unknown Channel";

  return (
    <DataTableActions
      label={`Open actions for ${channelName}`}
      items={[
        {
          label: "Details",
          onSelect: () => onOpenDetails(subscription),
        },
        {
          label: "Reuse",
          disabled: !session?.user?.id,
          onSelect: () => {
            if (!session?.user?.id) return;
            modal.open(
              <SubscriptionDialog
                defaultValues={{
                  channelId: subscription.channelId,
                  connectionId: subscription.connectionId,
                  ownerType: "USER",
                  ownerId: session.user.id,
                  topicType: subscription.topicType,
                  topicKey: subscription.topicKey,
                  eventTypes: '["family.library.updated"]',
                }}
                userId={session.user.id}
              />,
            );
          },
        },
        {
          label: subscription.status === "active" ? "Remove" : "Enable",
          variant: subscription.status === "active" ? "destructive" : "default",
          onSelect: () =>
            updateSubscriptionStatus.mutate({
              id: subscription.id,
              status: subscription.status === "active" ? "disabled" : "active",
            }),
        },
      ]}
    />
  );
}
