import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  DataTableActions,
  objectColumn,
  statusColumn,
  type DataTableStatusTone,
} from "@repo/data-table";
import type { TaskDefinitionDto } from "@/api/modules/platform/task/contract";
import { deleteTaskDefinition, updateTaskDefinition } from "@/features/tasks/api";
import { useToastError } from "@/lib/toast-error";

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
    cell: ({ row }) => <TaskActions task={row.original} />,
    meta: {
      kind: "actions",
      priority: "secondary",
      align: "right",
    },
  },
];

function TaskActions({ task }: { task: TaskDefinitionDto }) {
  const queryClient = useQueryClient();
  const updateTask = useMutation({
    mutationFn: async (input: { id: string; enabled: boolean }) =>
      updateTaskDefinition(input.id, { enabled: input.enabled }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["task", data.id] });
      toast.success("Task updated", {
        description: `Task is now ${data.enabled ? "enabled" : "disabled"}.`,
      });
    },
  });
  const deleteTask = useMutation({
    mutationFn: async (id: string) => deleteTaskDefinition(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
  });

  useToastError(updateTask.error, { title: "Failed to update task" });
  useToastError(deleteTask.error, { title: "Failed to delete task" });

  return (
    <DataTableActions
      label={`Open actions for ${task.kind}`}
      items={[
        { label: "View history", href: `/tasks/${task.id}` },
        {
          label: task.enabled ? "Disable" : "Enable",
          variant: task.enabled ? "destructive" : "default",
          onSelect: () => updateTask.mutate({ id: task.id, enabled: !task.enabled }),
        },
        {
          label: "Delete",
          variant: "destructive",
          onSelect: () => deleteTask.mutate(task.id),
        },
      ]}
    />
  );
}
