import { Button } from "@repo/ui/components/button";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useState, type ReactNode } from "react";
import { DataTable, statusColumn, timeColumn, type DataTableStatusTone } from "@repo/data-table";

import {
  DashboardActionBar,
  DashboardNotice,
  DashboardPanel,
  DashboardPagination,
  DashboardStatusPill,
} from "@/components/dashboard-ui";
import { taskColumns } from "./columns";
import { useTaskDetailQuery, useTaskRuns, useTasksQuery } from "@/features/tasks/query";
import type { TaskRunDto } from "@/api/modules/platform/task/contract";

export function TasksPage() {
  const location = useLocation();
  const isTaskChildRoute = location.pathname.startsWith("/tasks/");
  const tasksQuery = useTasksQuery();
  const tasksData = tasksQuery.data;

  if (isTaskChildRoute) {
    return <Outlet />;
  }

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button onClick={() => void tasksQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      <DataTable
        columns={taskColumns}
        data={tasksData?.data ?? []}
        empty={{ title: "No tasks", description: "No tasks available." }}
      />
    </div>
  );
}

export function TaskDetailPage({ taskId }: { taskId: string }) {
  const pageSize = 10;
  const [historyPage, setHistoryPage] = useState(1);
  const taskQuery = useTaskDetailQuery(taskId);
  const { data: taskRuns } = useTaskRuns(taskId, { page: historyPage, pageSize });

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button variant="outline" render={<Link to="/tasks" />}>
          Back
        </Button>
        <Button onClick={() => taskQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      {taskQuery.isError ? (
        <DashboardNotice title="Task unavailable" tone="error">
          Failed to load task detail.
        </DashboardNotice>
      ) : null}

      {taskQuery.data ? (
        <>
          <DashboardPanel
            eyebrow="Definition"
            title={taskQuery.data.kind}
            description={taskQuery.data.id}
          >
            <dl className="grid gap-4 text-sm md:grid-cols-3">
              <TaskMeta label="Connection">
                {getTaskConnectionId(taskQuery.data.payload) ?? "—"}
              </TaskMeta>
              <TaskMeta label="Schedule">{taskQuery.data.schedule}</TaskMeta>
              <TaskMeta label="Enabled">
                <DashboardStatusPill
                  text={taskQuery.data.enabled ? "enabled" : "disabled"}
                  tone={taskQuery.data.enabled ? "success" : "neutral"}
                />
              </TaskMeta>
            </dl>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="Task"
            title="Run State"
            description="Current scheduler state and the latest execution result."
          >
            <dl className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
              <TaskMeta label="Last Status">
                <DashboardStatusPill
                  text={taskQuery.data.lastRunStatus ?? "never run"}
                  tone={statusTone(taskQuery.data.lastRunStatus)}
                />
              </TaskMeta>
              <TaskMeta label="Last Triggered">
                {formatDateTime(taskQuery.data.lastTriggeredAt)}
              </TaskMeta>
              <TaskMeta label="Last Run">{formatDateTime(taskQuery.data.lastRunAt)}</TaskMeta>
              {taskQuery.data.lastError ? (
                <div className="md:col-span-2 lg:col-span-4">
                  <TaskMeta label="Last Error">{taskQuery.data.lastError}</TaskMeta>
                </div>
              ) : null}
            </dl>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="History"
            title="Run History"
            description="Recent task runs ordered by creation time."
          >
            <DataTable
              columns={taskRunColumns}
              data={taskRuns?.data ?? []}
              empty={{ title: "No runs", description: "No runs yet." }}
            />
            <DashboardPagination
              page={taskRuns?.page?.page ?? 1}
              pageSize={taskRuns?.page?.pageSize ?? 10}
              total={taskRuns?.page?.total ?? 0}
              totalPages={taskRuns?.page?.totalPages ?? 0}
              onPageChange={setHistoryPage}
            />
          </DashboardPanel>
        </>
      ) : taskQuery.isLoading ? (
        <DashboardNotice>Loading task detail.</DashboardNotice>
      ) : null}
    </div>
  );
}

const taskRunColumns: ColumnDef<TaskRunDto>[] = [
  timeColumn({
    id: "createdAt",
    header: "Created",
    value: (row) => row.createdAt,
  }),
  statusColumn({
    id: "status",
    header: "Status",
    text: (row) => row.status,
    tone: (row): DataTableStatusTone => statusTone(row.status),
  }),
  timeColumn({
    id: "scheduledFor",
    header: "Scheduled",
    value: (row) => row.scheduledFor,
  }),
  timeColumn({
    id: "startedAt",
    header: "Started",
    value: (row) => row.startedAt,
    empty: "—",
  }),
  timeColumn({
    id: "finishedAt",
    header: "Finished",
    value: (row) => row.finishedAt,
    empty: "—",
  }),
  {
    id: "result",
    header: "Result",
    cell: ({ row }) => {
      if (row.original.errorMessage) return row.original.errorMessage;
      if (row.original.summary === null || row.original.summary === undefined) return "—";
      return (
        <pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5">
          {formatSummary(row.original.summary)}
        </pre>
      );
    },
  },
];

function TaskMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm leading-6 text-foreground">{children}</dd>
    </div>
  );
}

function statusTone(
  status: string | null | undefined,
): "neutral" | "success" | "warning" | "danger" {
  const normalized = status?.toLowerCase();
  if (normalized === "done" || normalized === "success") return "success";
  if (normalized === "failed" || normalized === "error") return "danger";
  if (normalized === "queued" || normalized === "processing" || normalized === "running") {
    return "warning";
  }
  return "neutral";
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value as string;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatSummary(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function getTaskConnectionId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>).connectionId;
  return typeof value === "string" ? value : null;
}
