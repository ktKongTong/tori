import type { ColumnDef } from "@tanstack/react-table";

import { objectColumn, statusColumn, timeColumn, type DataTableStatusTone } from "@repo/data-table";

import type { IntegrationConnectionListItem } from "@/features/integration/api";

export function createIntegrationConnectionColumns(): ColumnDef<IntegrationConnectionListItem>[] {
  return [
    objectColumn({
      id: "account",
      header: "Account",
      title: (row) => row.providerAccountName ?? row.providerAccountId,
      // onOpen: input.onOpenDetails,
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
  ];
}
