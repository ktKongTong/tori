import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import { SubscriptionDialog } from "./create-subscription-form";
import { updateSubscriptionStatus as updateSubscriptionStatusRequest } from "@/features/notify/api";
import { useModal } from "@/lib/modal";
import { useSession } from "@/lib/auth-client";
import { useToastError } from "@/lib/toast-error";
import type { NotifySubscriptionView as OriginalNotifySubscriptionView } from "@/features/notify/api";

export type NotifySubscriptionView = OriginalNotifySubscriptionView;

export function createNotifySubscriptionColumns(input: {
  onOpenDetails: (subscription: NotifySubscriptionView) => void;
}): ColumnDef<NotifySubscriptionView>[] {
  return [
    {
      accessorKey: "channel",
      header: "Channel Binding",
      cell: ({ row }) => row.original.channel?.name ?? row.original.channelId,
    },
    {
      accessorKey: "botInstance",
      header: "Bot Runtime",
      cell: ({ row }) => row.original.botInstance?.displayName ?? row.original.botPluginInstanceId,
    },
    {
      accessorKey: "topic",
      header: "Topic",
      cell: ({ row }) => `${row.original.topicType} / ${row.original.topicKey}`,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <DashboardStatusPill text={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <NotifySubscriptionActions
          onOpenDetails={input.onOpenDetails}
          subscription={row.original}
        />
      ),
    },
  ];
}

function NotifySubscriptionActions({
  onOpenDetails,
  subscription,
}: {
  onOpenDetails: (subscription: NotifySubscriptionView) => void;
  subscription: NotifySubscriptionView;
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

  const channelName = subscription.channel?.name ?? subscription.channelId;

  return (
    <DashboardTableActions
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
          label: subscription.status === "active" ? "Disable" : "Enable",
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
