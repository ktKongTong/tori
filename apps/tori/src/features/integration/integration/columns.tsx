import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  timeColumn,
  type DataTableStatusTone,
} from "@repo/data-table";

import {
  checkConnectionAction,
  deleteConnection,
  updateConnectionStatus,
  type IntegrationConnectionListItem,
} from "@/features/integration/api";
import { ActionImpactDialog } from "@/features/action-check/confirm-dialog";
import { useToastError } from "@/lib/toast-error";

export function createIntegrationConnectionColumns(input?: {
  onOpenDetails?: (connection: IntegrationConnectionListItem) => void;
}): ColumnDef<IntegrationConnectionListItem>[] {
  return [
    objectColumn({
      id: "account",
      header: "Account",
      title: (row) => row.providerAccountName ?? row.providerAccountId,
      onOpen: input?.onOpenDetails,
    }),
    {
      id: "provider",
      header: "Provider",
      cell: ({ row }) => row.original.provider,
    },
    {
      id: "defaultState",
      header: "Default",
      cell: ({ row }) => (row.original.isDefault ? "Default" : "—"),
    },
    statusColumn({
      id: "health",
      header: "Health",
      text: (row) => {
        if (row.status !== "active") return row.status;
        if (row.proxy && row.proxy.status !== "active") return "Proxy Unhealthy";
        return "Active";
      },
      tone: (row): DataTableStatusTone => {
        if (row.status !== "active") return "danger";
        if (row.proxy && row.proxy.status !== "active") return "danger";
        return "success";
      },
      detail: (row) => {
        if (row.status !== "active") return "The connection is currently inactive.";
        if (row.proxy && row.proxy.status !== "active")
          return `Attached proxy '${row.proxy.name}' is not active.`;
        return null;
      },
    }),
    statusColumn({
      id: "accessMode",
      header: "Access Mode",
      text: (row) => row.accessMode,
      tone: () => "neutral",
    }),
    timeColumn({
      id: "lastSyncedAt",
      header: "Last Synced",
      value: (row) => row.lastSyncedAt,
      empty: "Never synced",
    }),
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <IntegrationConnectionActions
          connection={row.original}
          onOpenDetails={input?.onOpenDetails}
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

function IntegrationConnectionActions({
  connection,
  onOpenDetails,
}: {
  connection: IntegrationConnectionListItem;
  onOpenDetails?: (connection: IntegrationConnectionListItem) => void;
}) {
  const queryClient = useQueryClient();
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof checkConnectionAction>> | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const updateStatus = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "disabled" }) =>
      updateConnectionStatus(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
      toast.success("Connection updated", {
        description: `Connection is now ${data.status}.`,
      });
    },
  });
  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: string) => deleteConnection(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
      await queryClient.invalidateQueries({ queryKey: ["notify", "subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Connection deleted");
    },
  });

  useToastError(updateStatus.error, { title: "Failed to update connection" });
  useToastError(deleteConnectionMutation.error, { title: "Failed to delete connection" });

  const accountName = connection.providerAccountName ?? connection.providerAccountId;

  return (
    <>
      <DataTableActions
        label={`Open actions for ${accountName}`}
        items={[
          {
            label: "Details",
            disabled: !onOpenDetails,
            onSelect: () => onOpenDetails?.(connection),
          },
          {
            label: connection.status === "active" ? "Disable" : "Enable",
            variant: connection.status === "active" ? "destructive" : "default",
            onSelect: () => {
              void (async () => {
                const status = connection.status === "active" ? "disabled" : "active";
                if (status === "disabled") {
                  const nextImpact = await checkConnectionAction({
                    id: connection.id,
                    action: "disable",
                  });
                  setImpact(nextImpact);
                  setPendingAction(() => () => updateStatus.mutate({ id: connection.id, status }));
                  return;
                }
                updateStatus.mutate({ id: connection.id, status });
              })();
            },
          },
          {
            label: "Delete",
            variant: "destructive",
            onSelect: () => {
              void (async () => {
                const nextImpact = await checkConnectionAction({
                  id: connection.id,
                  action: "delete",
                });
                setImpact(nextImpact);
                setPendingAction(() => () => deleteConnectionMutation.mutate(connection.id));
              })();
            },
          },
        ]}
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
