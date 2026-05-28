import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  DashboardActionBar,
  DashboardLimitPager,
  DashboardNotice,
  DashboardStatusPill,
  DashboardTable,
} from "~/components/dashboard-ui";
import { apiRequest, requestLogsListSchema } from "~/lib/api";

export const Route = createFileRoute("/dashboard/logs")({
  component: DashboardRequestLogsPage,
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

function DashboardRequestLogsPage() {
  const [page, setPage] = useState(1);
  const requestLogsQuery = useQuery({
    queryKey: ["token-proxy", "request-logs", page],
    queryFn: () =>
      apiRequest(`/admin/request-logs?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`).then(
        (payload) => requestLogsListSchema.parse(payload),
      ),
  });

  const requestLogs = requestLogsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <DashboardActionBar>
        <Button onClick={() => void requestLogsQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      {requestLogsQuery.isLoading ? (
        <DashboardNotice title="Loading">Fetching request logs.</DashboardNotice>
      ) : null}
      {requestLogsQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{requestLogsQuery.error.message}</DashboardNotice>
      ) : null}

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
        page={page}
        pageSize={PAGE_SIZE}
        itemCount={requestLogs.length}
        onPageChange={setPage}
      />
    </div>
  );
}
