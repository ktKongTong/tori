import type { ColumnDef } from "@tanstack/react-table";

import { objectColumn, statusColumn, timeColumn, type DataTableStatusTone } from "@repo/data-table";

import type { IntegrationConnectionListItem } from "@/features/integration/api";

export function createIntegrationConnectionColumns(input: {
  onOpenDetails: (item: IntegrationConnectionListItem) => void;
}): ColumnDef<IntegrationConnectionListItem>[] {
  return [
    objectColumn({
      id: "account",
      header: "Account",
      title: (row) =>
        row.profile?.personaName ??
        row.connection.providerAccountName ??
        row.connection.providerAccountId,
      onOpen: input.onOpenDetails,
    }),
    {
      id: "provider",
      header: "Provider",
      cell: ({ row }) => row.original.connection.provider,
    },
    {
      id: "defaultState",
      header: "Default",
      cell: ({ row }) => (row.original.connection.isDefault ? "Default" : "—"),
    },
    statusColumn({
      id: "health",
      header: "Health",
      text: (row) => {
        if (row.connection.status !== "active") return row.connection.status;
        if (!row.profile) return "Profile Missing";
        if (row.proxy && row.proxy.status !== "active") return "Proxy Unhealthy";
        return "Active";
      },
      tone: (row): DataTableStatusTone => {
        if (row.connection.status !== "active") return "danger";
        if (!row.profile) return "warning";
        if (row.proxy && row.proxy.status !== "active") return "danger";
        return "success";
      },
      detail: (row) => {
        if (row.connection.status !== "active") return "The connection is currently inactive.";
        if (!row.profile) return "The profile for this connection has not been fetched yet.";
        if (row.proxy && row.proxy.status !== "active")
          return `Attached proxy '${row.proxy.name}' is not active.`;
        return null;
      },
    }),
    statusColumn({
      id: "accessMode",
      header: "Access Mode",
      text: (row) => row.connection.accessMode,
      tone: () => "neutral",
    }),
    timeColumn({
      id: "lastSyncedAt",
      header: "Last Synced",
      value: (row) => row.connection.lastSyncedAt,
      empty: "Never synced",
    }),
  ];
}
