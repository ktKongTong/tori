import type { ColumnDef } from "@tanstack/react-table";

import { DashboardStatusPill, DashboardTableActions } from "@/components/dashboard-ui";
import type { TaskDefinitionDto } from "@/api/modules/platform/task/contract";

export const taskColumns: ColumnDef<TaskDefinitionDto>[] = [
  {
    accessorKey: "kind",
    header: "Task",
    cell: ({ row }) => row.original.kind,
  },
  {
    accessorKey: "schedule",
    header: "Schedule",
    cell: ({ row }) => row.original.schedule,
  },
  {
    accessorKey: "enabled",
    header: "Enabled",
    cell: ({ row }) => <DashboardStatusPill text={row.original.enabled ? "enabled" : "disabled"} />,
  },
  {
    accessorKey: "lastRunStatus",
    header: "Last Run",
    cell: ({ row }) => row.original.lastRunStatus ?? "—",
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <DashboardTableActions
        label="Task actions"
        items={[{ label: "View history", to: `/tasks/${row.original.id}` }]}
      />
    ),
  },
];
