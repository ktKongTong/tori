import type { ColumnDef } from "@tanstack/react-table";

import { DashboardStatusPill } from "@/components/dashboard-ui";
import type { ClaimSessionDto } from "@/api/modules/platform/binding/contract";

export const bindingClaimColumns: ColumnDef<ClaimSessionDto>[] = [
  {
    accessorKey: "anonymousUserName",
    header: "Anonymous User Name",
    cell: ({ row }) => row.original.anonymousUserName,
  },
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => row.original.observedUserPlatform ?? row.original.observedChannelPlatform,
  },
  {
    accessorKey: "observedUserName",
    header: "Observed User Name",
    cell: ({ row }) => row.original.observedUserName,
  },
  {
    accessorKey: "observedChannelName",
    header: "Observed Channel Name",
    cell: ({ row }) => row.original.observedChannelName,
  },
  {
    accessorKey: "purpose",
    header: "Purpose",
    cell: ({ row }) => row.original.purpose,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <DashboardStatusPill text={row.original.status} />,
  },
];
