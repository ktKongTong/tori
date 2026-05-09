import type { ColumnDef } from "@tanstack/react-table";

import { objectColumn, statusColumn, timeColumn, type DataTableStatusTone } from "@repo/data-table";
import type { ClaimSessionDto } from "@/api/modules/platform/binding/contract";

export const bindingClaimColumns: ColumnDef<ClaimSessionDto>[] = [
  objectColumn({
    id: "observedTarget",
    header: "Observed Target",
    title: (row) =>
      row.observedUserName ??
      row.observedChannelName ??
      row.observedUserId ??
      row.observedChannelId ??
      "Unknown Observer Target",
  }),
  {
    id: "platform",
    header: "Platform",
    cell: ({ row }) =>
      row.original.observedUserPlatform ?? row.original.observedChannelPlatform ?? "—",
  },
  {
    id: "purpose",
    header: "Purpose",
    cell: ({ row }) => row.original.purpose,
  },
  {
    id: "anonymousUser",
    header: "Anonymous User",
    cell: ({ row }) => row.original.anonymousUserName ?? "—",
  },
  statusColumn({
    id: "status",
    header: "Status",
    text: (row) => row.status,
    tone: (row): DataTableStatusTone => {
      if (row.status === "resolved") return "success";
      if (row.status === "failed") return "danger";
      if (row.status === "pending") return "warning";
      return "neutral";
    },
    detail: (row) => row.resolution ?? null,
  }),
  timeColumn({
    id: "createdAt",
    header: "Created At",
    value: (row) => row.createdAt,
  }),
];
