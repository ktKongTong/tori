import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  metadataColumn,
  type DataTableStatusTone,
} from "@repo/data-table";

import { InspectTokenProxyDialog } from "./proxy-dialogs";
import {
  probeProxyInstance,
  updateProxyStatus as updateProxyInstanceStatus,
} from "@/features/integration/api";
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

  return (
    <DataTableActions
      label={`Open actions for ${proxy.name}`}
      items={[
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
        {
          label: "Refresh Capabilities",
          onSelect: () => probeProxy.mutate(proxy.id),
        },
        {
          label: proxy.status === "active" ? "Disable" : "Enable",
          variant: proxy.status === "active" ? "destructive" : "default",
          onSelect: () =>
            updateProxyStatus.mutate({
              id: proxy.id,
              status: proxy.status === "active" ? "disabled" : "active",
            }),
        },
      ]}
    />
  );
}
