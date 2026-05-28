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
import { apiRequest, connectionsListSchema, requestLogsListSchema } from "~/lib/api";

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

function parseTarget(targetUrl: string | null | undefined) {
  if (!targetUrl) {
    return { host: "—", path: "—" };
  }

  try {
    const url = new URL(targetUrl);
    return { host: url.host, path: url.pathname || "/" };
  } catch {
    return { host: "—", path: targetUrl };
  }
}

function formatJson(value: unknown) {
  if (value === undefined || value === null) {
    return "—";
  }

  return JSON.stringify(value, null, 2);
}

function RequestLogDetails({
  headers,
  requestBody,
}: {
  headers: Record<string, string> | null | undefined;
  requestBody: unknown;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Headers
        </p>
        <pre className="max-h-72 overflow-auto border border-border/70 bg-background p-3 text-xs leading-5 whitespace-pre-wrap">
          {formatJson(headers)}
        </pre>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Request Body
        </p>
        <pre className="max-h-72 overflow-auto border border-border/70 bg-background p-3 text-xs leading-5 whitespace-pre-wrap">
          {formatJson(requestBody)}
        </pre>
      </div>
    </div>
  );
}

function DashboardRequestLogsPage() {
  const [page, setPage] = useState(1);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());
  const requestLogsQuery = useQuery({
    queryKey: ["token-proxy", "request-logs", page],
    queryFn: () =>
      apiRequest(`/admin/request-logs?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`).then(
        (payload) => requestLogsListSchema.parse(payload),
      ),
  });
  const connectionsQuery = useQuery({
    queryKey: ["token-proxy", "connections"],
    queryFn: () =>
      apiRequest("/admin/connections").then((payload) => connectionsListSchema.parse(payload)),
  });

  const requestLogs = requestLogsQuery.data?.items ?? [];
  const connectionNames = new Map(
    (connectionsQuery.data?.items ?? []).map((connection) => [
      connection.id,
      connection.label || connection.displayName || connection.provider,
    ]),
  );

  function toggleExpanded(logId: number) {
    setExpandedLogIds((current) => {
      const next = new Set(current);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }

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
        columns={["Time", "Connection", "Method", "Status", "Host", "Path", "Error", "Details"]}
        rows={requestLogs.map((log) => {
          const target = parseTarget(log.targetUrl);

          return [
            formatDate(log.createdAt),
            <div key={`${log.id}-connection`} className="space-y-1">
              <p className="font-medium text-foreground">
                {connectionNames.get(log.connectionId) ?? log.connectionId}
              </p>
              {connectionNames.has(log.connectionId) ? (
                <p className="text-xs text-muted-foreground">{log.connectionId}</p>
              ) : null}
            </div>,
            log.method,
            <DashboardStatusPill
              key={`${log.id}-status`}
              text={log.statusCode ? String(log.statusCode) : "Pending"}
              tone={getRequestStatusTone(log.statusCode, log.error)}
            />,
            <code key={`${log.id}-host`} className="break-all text-xs">
              {target.host}
            </code>,
            <code key={`${log.id}-path`} className="break-all text-xs">
              {target.path}
            </code>,
            log.error ? <span className="text-destructive">{log.error}</span> : "—",
            <Button
              key={`${log.id}-details`}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleExpanded(log.id)}
            >
              {expandedLogIds.has(log.id) ? "Hide" : "Show"}
            </Button>,
          ];
        })}
        rowIds={requestLogs.map((log) => String(log.id))}
        expandedRows={requestLogs.map((log) =>
          expandedLogIds.has(log.id) ? (
            <RequestLogDetails
              key={`${log.id}-expanded`}
              headers={log.headers}
              requestBody={log.requestBody}
            />
          ) : null,
        )}
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
