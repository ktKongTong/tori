import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  metadataColumn,
  type DataTableStatusTone,
  type DataTableActionItem,
} from "@repo/data-table";

import { InspectTokenProxyDialog } from "./proxy-dialogs";
import {
  checkProxyAction,
  deleteProxyInstance,
  probeProxyInstance,
  updateProxyStatus as updateProxyInstanceStatus,
} from "@/features/integration/api";
import { ActionImpactDialog } from "@/features/action-check/confirm-dialog";
import { useModal } from "@/lib/modal";
import type { ProxyInstanceDto } from "@/api/modules/platform/integration/contract";

export const integrationProxyColumns: ColumnDef<ProxyInstanceDto>[] = [
  objectColumn({
    id: "name",
    header: "Name",
    title: (row) => row.name,
  }),
  {
    id: "baseUrl",
    header: "Base URL",
    cell: ({ row }) => row.original.baseUrl,
  },
  metadataColumn({
    id: "providers",
    header: "Providers",
    value: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.providers.length > 0 ? (
          row.providers.map((p) => (
            <span
              key={p.name}
              className="rounded bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground border border-border/40"
            >
              {p.name} ({p.flow})
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    ),
  }),
  statusColumn({
    id: "healthStatus",
    header: "Health",
    text: (row) => row.healthStatus,
    tone: (row): DataTableStatusTone => {
      if (row.healthStatus === "healthy") return "success";
      if (row.healthStatus === "unhealthy") return "danger";
      return "neutral";
    },
  }),
  statusColumn({
    id: "status",
    header: "Status",
    text: (row) => row.status,
    tone: (row): DataTableStatusTone => {
      if (row.status === "active") return "success";
      if (row.status === "disabled") return "warning";
      return "neutral";
    },
  }),
  {
    id: "actions",
    header: "",
    cell: ({ row }) => <IntegrationProxyActions proxy={row.original} />,
    meta: {
      kind: "actions",
      priority: "secondary",
      align: "right",
    },
  },
];

function IntegrationProxyActions({ proxy }: { proxy: ProxyInstanceDto }) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof checkProxyAction>> | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const probeProxy = useMutation({
    mutationFn: async (proxyId: string) => probeProxyInstance(proxyId),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "proxy-instances"] });
      toast.success("Proxy probed", {
        description: `Health: ${data.healthStatus}\nProviders: ${data.providers.map((provider) => `${provider.name} (${provider.flow})`).join(", ") || "none"}`,
      });
    },
  });
  const updateProxyStatus = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "disabled" }) =>
      updateProxyInstanceStatus(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "proxy-instances"] });
      toast.success("Proxy updated", {
        description: `Proxy instance is now ${data.status}.`,
      });
    },
  });
  const deleteProxy = useMutation({
    mutationFn: async (id: string) => deleteProxyInstance(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "proxy-instances"] });
      await queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
      await queryClient.invalidateQueries({ queryKey: ["notify", "subscriptions"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Proxy deleted");
    },
  });

  const canManage = proxy.canManage ?? true;
  const manageItems: DataTableActionItem[] = canManage
    ? [
        {
          label: "Refresh Capabilities",
          onSelect: () => probeProxy.mutate(proxy.id),
        },
        {
          label: proxy.status === "active" ? "Disable" : "Enable",
          variant: proxy.status === "active" ? "destructive" : "default",
          onSelect: () => {
            void (async () => {
              const status = proxy.status === "active" ? "disabled" : "active";
              if (status === "disabled") {
                const nextImpact = await checkProxyAction({ id: proxy.id, action: "disable" });
                setImpact(nextImpact);
                setPendingAction(() => () => updateProxyStatus.mutate({ id: proxy.id, status }));
                return;
              }
              updateProxyStatus.mutate({ id: proxy.id, status });
            })();
          },
        },
        {
          label: "Delete",
          variant: "destructive",
          onSelect: () => {
            void (async () => {
              const nextImpact = await checkProxyAction({ id: proxy.id, action: "delete" });
              setImpact(nextImpact);
              setPendingAction(() => () => deleteProxy.mutate(proxy.id));
            })();
          },
        },
      ]
    : [];
  const items: DataTableActionItem[] = [
    {
      label: "Inspect",
      onSelect: () => {
        modal.open(
          <InspectTokenProxyDialog
            proxy={{
              baseUrl: proxy.baseUrl,
              healthStatus: proxy.healthStatus,
              name: proxy.name ?? proxy.baseUrl,
              providers: proxy.providers,
            }}
          />,
        );
      },
    },
    ...manageItems,
  ];

  return (
    <>
      <DataTableActions label={`Open actions for ${proxy.name}`} items={items} />
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
