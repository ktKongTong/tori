import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  DashboardActionBar,
  DashboardLimitPager,
  DashboardNotice,
  DashboardStatusPill,
  DashboardTable,
} from "~/components/dashboard-ui";
import {
  apiRequest,
  requestLogsListSchema,
  systemTaskRunsListSchema,
  tokenRefreshLogsListSchema,
} from "~/lib/api";

export const Route = createFileRoute("/dashboard/logs")({
  component: DashboardLogsPage,
});

const PAGE_SIZE = 20;

function formatDate(epochSeconds: number | null | undefined) {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleString();
}

function getRequestStatusTone(
  statusCode: number | null | undefined,
  error: string | null | undefined,
) {
  if (error || (statusCode ?? 0) >= 500) return "danger" as const;
  if ((statusCode ?? 0) >= 400) return "warning" as const;
  if (statusCode && statusCode < 400) return "success" as const;
  return "neutral" as const;
}

function getRefreshStatusTone(status: string) {
  if (status === "SUCCESS") return "success" as const;
  if (status === "FAIL") return "danger" as const;
  if (status === "SKIP") return "warning" as const;
  return "neutral" as const;
}

function DashboardLogsPage() {
  const queryClient = useQueryClient();
  const [requestLogPage, setRequestLogPage] = useState(1);
  const [refreshLogPage, setRefreshLogPage] = useState(1);
  const requestLogsQuery = useQuery({
    queryKey: ["token-proxy", "logs", requestLogPage],
    queryFn: () =>
      apiRequest(
        `/admin/request-logs?limit=${PAGE_SIZE}&offset=${(requestLogPage - 1) * PAGE_SIZE}`,
      ).then((payload) => requestLogsListSchema.parse(payload)),
  });
  const refreshLogsQuery = useQuery({
    queryKey: ["token-proxy", "refresh-logs", refreshLogPage],
    queryFn: () =>
      apiRequest(
        `/admin/refresh-logs?limit=${PAGE_SIZE}&offset=${(refreshLogPage - 1) * PAGE_SIZE}`,
      ).then((payload) => tokenRefreshLogsListSchema.parse(payload)),
  });

  const runRefreshTasksMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/admin/system/run-all", {
        method: "POST",
      }).then((payload) => systemTaskRunsListSchema.parse(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["token-proxy", "refresh-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["token-proxy", "logs"] });
    },
  });

  const requestLogs = requestLogsQuery.data?.items ?? [];
  const refreshLogs = refreshLogsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <DashboardActionBar>
        <Button
          onClick={() => {
            void requestLogsQuery.refetch();
            void refreshLogsQuery.refetch();
          }}
          variant="outline"
        >
          Refresh
        </Button>
        <Button
          onClick={() => runRefreshTasksMutation.mutate()}
          disabled={runRefreshTasksMutation.isPending}
        >
          {runRefreshTasksMutation.isPending ? "Running..." : "Run Refresh Now"}
        </Button>
      </DashboardActionBar>

      {requestLogsQuery.isLoading || refreshLogsQuery.isLoading ? (
        <DashboardNotice title="Loading">Fetching the latest logs.</DashboardNotice>
      ) : null}
      {requestLogsQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{requestLogsQuery.error.message}</DashboardNotice>
      ) : null}
      {refreshLogsQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{refreshLogsQuery.error.message}</DashboardNotice>
      ) : null}
      {runRefreshTasksMutation.error instanceof Error ? (
        <DashboardNotice tone="error">{runRefreshTasksMutation.error.message}</DashboardNotice>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Request Logs
        </h2>
        <DashboardTable
          columns={["Time", "Connection", "Route", "Method", "Status", "Target", "Error"]}
          rows={requestLogs.map((log) => [
            formatDate(log.createdAt),
            <div key={`${log.id}-connection`} className="space-y-1">
              <p className="font-medium text-foreground">{log.connectionId}</p>
              <p className="text-xs text-muted-foreground">Log #{log.id}</p>
            </div>,
            log.routeGroup,
            log.method,
            <DashboardStatusPill
              key={`${log.id}-status`}
              text={log.statusCode ? String(log.statusCode) : "Pending"}
              tone={getRequestStatusTone(log.statusCode, log.error)}
            />,
            log.targetUrl ?? "—",
            log.error ? <span className="text-destructive">{log.error}</span> : "—",
          ])}
          rowIds={requestLogs.map((log) => String(log.id))}
          empty="No request logs have been recorded yet."
        />
        <DashboardLimitPager
          page={requestLogPage}
          pageSize={PAGE_SIZE}
          itemCount={requestLogs.length}
          onPageChange={setRequestLogPage}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Refresh Logs
        </h2>
        <DashboardTable
          columns={["Time", "Provider", "Connection", "Status", "Task Run", "Message"]}
          rows={refreshLogs.map((log) => [
            formatDate(log.createdAt),
            log.provider,
            log.connectionId,
            <DashboardStatusPill
              key={`${log.id}-status`}
              text={log.status}
              tone={getRefreshStatusTone(log.status)}
            />,
            log.taskRunId ?? "—",
            log.message ?? "—",
          ])}
          rowIds={refreshLogs.map((log) => String(log.id))}
          empty="No refresh logs have been recorded yet."
        />
        <DashboardLimitPager
          page={refreshLogPage}
          pageSize={PAGE_SIZE}
          itemCount={refreshLogs.length}
          onPageChange={setRefreshLogPage}
        />
      </section>
    </div>
  );
}
