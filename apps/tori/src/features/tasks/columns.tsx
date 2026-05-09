import type { ColumnDef } from "@tanstack/react-table";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  type DataTableStatusTone,
} from "@repo/data-table";
import type { TaskDefinitionDto } from "@/api/modules/platform/task/contract";

export const taskColumns: ColumnDef<TaskDefinitionDto>[] = [
  objectColumn({
    id: "kind",
    header: "Task",
    title: (row) => row.kind,
  }),
  {
    id: "schedule",
    header: "Schedule",
    cell: ({ row }) => row.original.schedule,
  },
  statusColumn({
    id: "enabled",
    header: "Enabled",
    text: (row) => (row.enabled ? "Enabled" : "Disabled"),
    tone: (row): DataTableStatusTone => (row.enabled ? "success" : "neutral"),
  }),
  statusColumn({
    id: "lastRunStatus",
    header: "Last Run",
    text: (row) => row.lastRunStatus ?? "Never",
    tone: (row): DataTableStatusTone => {
      const status = row.lastRunStatus?.toLowerCase();
      if (status === "done" || status === "success") return "success";
      if (status === "failed" || status === "error") return "danger";
      if (status === "queued" || status === "processing" || status === "running") return "warning";
      return "neutral";
    },
  }),
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <DataTableActions
        label="Task actions"
        items={[{ label: "View history", href: `/tasks/${row.original.id}` }]}
      />
    ),
    meta: {
      kind: "actions",
      priority: "secondary",
      align: "right",
    },
  },
];
