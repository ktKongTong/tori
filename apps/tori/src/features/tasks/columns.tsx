import type { ColumnDef } from "@tanstack/react-table";

import { DashboardStatusPill } from "@/components/dashboard-ui";
import type { DashboardTasksData } from "@/features/tasks/api";
import { useDashboardIntegrationQuery } from "@/features/integration/query";

export type TaskRow = DashboardTasksData["tasks"][number];

export const taskColumns: ColumnDef<TaskRow>[] = [
  {
    accessorKey: "kind",
    header: "Task",
    cell: ({ row }) => row.original.kind,
  },
  {
    accessorKey: "connection",
    header: "Connection",
    cell: ({ row }) => <TaskConnection task={row.original} />,
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
];

function TaskConnection({ task }: { task: TaskRow }) {
  const integrationQuery = useDashboardIntegrationQuery();
  return (
    task.connectionLabel ??
    integrationQuery.data?.connections.find((connection) => connection.id === task.connectionId)
      ?.accountLabel ??
    "—"
  );
}
