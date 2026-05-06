import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import { InspectTokenProxyDialog } from "./proxy-dialogs";
import {
  probeProxyInstance,
  updateProxyStatus as updateProxyInstanceStatus,
  type DashboardIntegrationData,
} from "@/features/integration/api";
import { useModal } from "@/lib/modal";

export type IntegrationProxyRow = DashboardIntegrationData["proxyInstances"][number];

export const integrationProxyColumns: ColumnDef<IntegrationProxyRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => row.original.name,
  },
  {
    accessorKey: "baseUrl",
    header: "Base URL",
    cell: ({ row }) => row.original.baseUrl,
  },
  {
    accessorKey: "providers",
    header: "Providers",
    cell: ({ row }) =>
      row.original.providers.map((provider) => `${provider.name} (${provider.flow})`).join(", ") ||
      "—",
  },
  {
    accessorKey: "healthStatus",
    header: "Health",
    cell: ({ row }) => <DashboardStatusPill text={row.original.healthStatus} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <DashboardStatusPill text={row.original.status} />,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <IntegrationProxyActions proxy={row.original} />,
  },
];

function IntegrationProxyActions({ proxy }: { proxy: IntegrationProxyRow }) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const probeProxy = useMutation({
    mutationFn: async (proxyId: string) => probeProxyInstance(proxyId),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "integration"] });
      toast.success("Proxy probed", {
        description: `Health: ${data.healthStatus}\nProviders: ${data.providers.map((provider) => `${provider.name} (${provider.flow})`).join(", ") || "none"}`,
      });
    },
  });
  const updateProxyStatus = useMutation({
    mutationFn: async (input: { id: string; status: "active" | "disabled" }) =>
      updateProxyInstanceStatus(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "integration"] });
      toast.success("Proxy updated", {
        description: `Proxy ${data.id} is now ${data.status}.`,
      });
    },
  });

  return (
    <DashboardTableActions
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
                  name: proxy.name,
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
