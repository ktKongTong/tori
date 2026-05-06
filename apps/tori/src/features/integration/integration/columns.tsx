import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import {
  fetchIntegrationAccountProfile,
  refreshIntegrationFamily,
  type DashboardIntegrationData,
} from "@/features/integration/api";
import { useToastError } from "@/lib/toast-error";

export type IntegrationConnectionRow = DashboardIntegrationData["connections"][number];

export const integrationConnectionColumns: ColumnDef<IntegrationConnectionRow>[] = [
  {
    accessorKey: "accountLabel",
    header: "Account",
    cell: ({ row }) => row.original.accountLabel,
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => row.original.provider,
  },
  {
    accessorKey: "accessMode",
    header: "Access",
    cell: ({ row }) => <DashboardStatusPill text={row.original.accessMode} />,
  },
  {
    accessorKey: "attachedProxy",
    header: "Attached Proxy",
    cell: ({ row }) => row.original.proxyName ?? "No proxy attached",
  },
  {
    accessorKey: "accountProfile",
    header: "Profile",
    cell: ({ row }) => {
      const profile = row.original.accountProfile;

      if (!profile) return "Not fetched";

      return profile.displayName ?? profile.externalAccountId;
    },
  },
  {
    accessorKey: "defaultState",
    header: "Default",
    cell: ({ row }) => (row.original.isDefault ? "Default" : "—"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <DashboardStatusPill text={row.original.status} />,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <IntegrationConnectionActions connection={row.original} />,
  },
];

function IntegrationConnectionActions({ connection }: { connection: IntegrationConnectionRow }) {
  const queryClient = useQueryClient();
  const fetchProfile = useMutation({
    mutationFn: async (connectionId: string) => fetchIntegrationAccountProfile(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "integration"] });
    },
  });
  const refreshFamily = useMutation({
    mutationFn: async (connectionId: string) => refreshIntegrationFamily(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "integration"] });
    },
  });

  useToastError(fetchProfile.error, { title: "Failed to fetch account profile" });

  return (
    <DashboardTableActions
      label={`Open actions for ${connection.accountLabel}`}
      items={[
        {
          label: "Fetch Profile",
          onSelect: () => fetchProfile.mutate(connection.id),
        },
        ...(connection.provider === "steam"
          ? [
              {
                label: "Refresh Family",
                onSelect: () => refreshFamily.mutate(connection.id),
              },
            ]
          : []),
      ]}
    />
  );
}
