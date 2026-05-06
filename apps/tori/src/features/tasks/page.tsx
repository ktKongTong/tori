import { Button } from "@repo/ui/components/button";
import { Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState, type ReactNode } from "react";
import {
  DashboardActionBar,
  DashboardNotice,
  DashboardPanel,
  DashboardStatusPill,
  DashboardTable,
} from "@/components/dashboard-ui";
import { taskColumns } from "./columns";
import { useSession } from "@/lib/auth-client";
import type { DashboardTaskDetailData } from "@/features/tasks/api";
import { useDashboardTaskDetailQuery, useDashboardTasksQuery } from "@/features/tasks/query";

export function TasksPage() {
  const { data: session } = useSession();
  const location = useLocation();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = role.includes("admin");
  const isTaskChildRoute = location.pathname.startsWith("/tasks/");
  const tasksQuery = useDashboardTasksQuery();
  const tasksData = tasksQuery.data;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

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

      <DashboardTable
        columns={taskColumns}
        data={tasksData?.tasks ?? []}
        empty="No tasks available."
      />
    </div>
  );
}

export function TaskDetailPage({ taskId }: { taskId: string }) {
  const pageSize = 10;
  const [historyPage, setHistoryPage] = useState(1);
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = role.includes("admin");
  const taskQuery = useDashboardTaskDetailQuery(taskId, { page: historyPage, pageSize });
  const taskData = taskQuery.data;

  useEffect(() => {
    setHistoryPage(1);
  }, [taskId]);

  useEffect(() => {
    if (taskData && historyPage > taskData.pagination.totalPages) {
      setHistoryPage(taskData.pagination.totalPages);
    }
  }, [historyPage, taskData]);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <DashboardActionBar>
        <Button variant="outline" render={<Link to="/tasks" />}>
          Back
        </Button>
        <Button onClick={() => void taskQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      {taskQuery.isError ? (
        <DashboardNotice title="Task unavailable" tone="error">
          Failed to load task detail.
        </DashboardNotice>
      ) : null}

      {taskData ? (
        <>
          <DashboardPanel
            eyebrow="Definition"
            title={taskData.task.kind}
            description={taskData.task.id}
          >
            <dl className="grid gap-4 text-sm md:grid-cols-3">
              <TaskMeta label="Connection">{taskData.task.connectionLabel ?? "—"}</TaskMeta>
              <TaskMeta label="Schedule">{taskData.task.schedule}</TaskMeta>
              <TaskMeta label="Enabled">
                <DashboardStatusPill
                  text={taskData.task.enabled ? "enabled" : "disabled"}
                  tone={taskData.task.enabled ? "success" : "neutral"}
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
                  text={taskData.task.lastRunStatus ?? "never run"}
                  tone={statusTone(taskData.task.lastRunStatus)}
                />
              </TaskMeta>
              <TaskMeta label="Last Triggered">
                {formatDateTime(taskData.task.lastTriggeredAt)}
              </TaskMeta>
              <TaskMeta label="Last Run">{formatDateTime(taskData.task.lastRunAt)}</TaskMeta>
              <TaskMeta label="Updated">{formatDateTime(taskData.task.updatedAt)}</TaskMeta>
              {taskData.task.lastError ? (
                <div className="md:col-span-2 lg:col-span-4">
                  <TaskMeta label="Last Error">{taskData.task.lastError}</TaskMeta>
                </div>
              ) : null}
            </dl>
          </DashboardPanel>

          <DashboardPanel
            eyebrow="History"
            title="Run History"
            description="Recent task runs ordered by creation time."
          >
            <DashboardTable columns={taskRunColumns} data={taskData.runs} empty="No runs yet." />
            <RunHistoryPagination
              page={taskData.pagination.page}
              pageSize={taskData.pagination.pageSize}
              total={taskData.pagination.total}
              totalPages={taskData.pagination.totalPages}
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

type TaskRunRow = DashboardTaskDetailData["runs"][number];

const taskRunColumns: ColumnDef<TaskRunRow>[] = [
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <DashboardStatusPill text={row.original.status} tone={statusTone(row.original.status)} />
    ),
  },
  {
    accessorKey: "scheduledFor",
    header: "Scheduled",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.scheduledFor)}</span>
    ),
  },
  {
    accessorKey: "startedAt",
    header: "Started",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.startedAt)}</span>
    ),
  },
  {
    accessorKey: "finishedAt",
    header: "Finished",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.finishedAt)}</span>
    ),
  },
  {
    accessorKey: "result",
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

function RunHistoryPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-x border-b border-border/70 px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {firstItem}-{lastItem} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="min-w-24 text-center text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
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
