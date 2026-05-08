import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import {
  fetchIntegrationAccountProfile,
  refreshIntegrationFamily,
  type ConnectionRow,
  type IntegrationConnectionRow,
} from "@/features/integration/api";
import { useToastError } from "@/lib/toast-error";

export const integrationConnectionColumns: ColumnDef<IntegrationConnectionRow>[] = [
  {
    accessorKey: "accountLabel",
    header: "Account",
    cell: ({ row }) =>
      row.original.connection.providerAccountName ?? row.original.connection.providerAccountId,
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => row.original.connection.provider,
  },
  {
    accessorKey: "accessMode",
    header: "Access",
    cell: ({ row }) => <DashboardStatusPill text={row.original.connection.accessMode} />,
  },
  {
    accessorKey: "attachedProxy",
    header: "Attached Proxy",
    cell: ({ row }) => row.original.proxy?.name ?? "No proxy attached",
  },
  {
    accessorKey: "accountProfile",
    header: "Profile",
    cell: ({ row }) => {
      const profile = row.original.profile;

      if (!profile) return "Not fetched";

      return profile.personaName ?? profile.steamId;
    },
  },
  {
    accessorKey: "defaultState",
    header: "Default",
    cell: ({ row }) => (row.original.connection.isDefault ? "Default" : "—"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <DashboardStatusPill text={row.original.connection.status} />,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <IntegrationConnectionActions connection={row.original.connection} />,
  },
];

function IntegrationConnectionActions({ connection }: { connection: ConnectionRow }) {
  const queryClient = useQueryClient();
  const fetchProfile = useMutation({
    mutationFn: async (connectionId: string) => fetchIntegrationAccountProfile(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
    },
  });
  const refreshFamily = useMutation({
    mutationFn: async (connectionId: string) => refreshIntegrationFamily(connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
    },
  });

  useToastError(fetchProfile.error, { title: "Failed to fetch account profile" });

  return (
    <DashboardTableActions
      label={`Open actions for ${connection.providerAccountName ?? connection.providerAccountId}`}
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
