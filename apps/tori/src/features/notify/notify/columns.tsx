import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import { SubscriptionDialog } from "./create-subscription-form";
import {
  updateSubscriptionStatus as updateSubscriptionStatusRequest,
  type DashboardNotifySubscriptionsData,
} from "@/features/notify/api";
import { useModal } from "@/lib/modal";
import { useSession } from "@/lib/auth-client";
import { useDashboardBindingQuery } from "@/features/binding/query";
import { useDashboardIntegrationQuery } from "@/features/integration/query";
import { useToastError } from "@/lib/toast-error";

export type NotifySubscriptionRow = DashboardNotifySubscriptionsData["subscriptions"][number];

export function createNotifySubscriptionColumns(input: {
  onOpenDetails: (subscription: NotifySubscriptionRow) => void;
}): ColumnDef<NotifySubscriptionRow>[] {
  return [
    {
      accessorKey: "channelLabel",
      header: "Channel Binding",
      cell: ({ row }) => row.original.channelLabel,
    },
    {
      accessorKey: "botPluginInstanceLabel",
      header: "Bot Runtime",
      cell: ({ row }) => row.original.botPluginInstanceLabel,
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
  onOpenDetails: (subscription: NotifySubscriptionRow) => void;
  subscription: NotifySubscriptionRow;
}) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const bindingQuery = useDashboardBindingQuery();
  const integrationQuery = useDashboardIntegrationQuery();
  const availableChannelBindings = bindingQuery.data?.channelBindings ?? [];
  const availableConnections =
    integrationQuery.data?.connections.filter((connection) => connection.status === "active") ?? [];
  const updateSubscriptionStatus = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "disabled" }) =>
      updateSubscriptionStatusRequest(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "notify", "subscriptions"] });
      toast.success("Subscription updated", {
        description: `Subscription ${data.id} is now ${data.status}.`,
      });
    },
  });

  useToastError(updateSubscriptionStatus.error, { title: "Failed to update subscription" });

  return (
    <DashboardTableActions
      label={`Open actions for ${subscription.channelLabel}`}
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
                availableChannelBindings={availableChannelBindings}
                availableConnections={availableConnections}
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
