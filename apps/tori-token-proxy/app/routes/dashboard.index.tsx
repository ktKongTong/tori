import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";

import { Button } from "@repo/ui/components/button";
import { DataTable, objectColumn, statusColumn, timeColumn, codeColumn } from "@repo/data-table";
import { DashboardActionBar, DashboardNotice } from "~/components/dashboard-ui";
import { apiRequest, connectionsListSchema, requestLogsListSchema } from "~/lib/api";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverviewPage,
});

function DashboardOverviewPage() {
  const connectionsQuery = useQuery({
    queryKey: ["token-proxy", "connections"],
    queryFn: () =>
      apiRequest("/admin/connections").then((payload) => connectionsListSchema.parse(payload)),
  });

  const logsQuery = useQuery({
    queryKey: ["token-proxy", "logs"],
    queryFn: () =>
      apiRequest("/admin/request-logs?limit=20").then((payload) =>
        requestLogsListSchema.parse(payload),
      ),
  });

  const connections = connectionsQuery.data?.items ?? [];
  const logs = logsQuery.data?.items ?? [];
  const recentConnections = [...connections].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const recentLogs = [...logs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);

  const connectionColumns = useMemo<ColumnDef<(typeof connections)[0]>[]>(
    () => [
      objectColumn({
        id: "provider",
        header: "Identity",
        title: (row) => row.displayName ?? row.provider,
      }),
      {
        id: "rawProvider",
        header: "Provider",
        cell: ({ row }) => row.original.provider,
      },
      codeColumn({
        id: "providerUid",
        header: "Provider UID",
        value: (row) => row.providerUid,
      }),
      statusColumn({
        id: "status",
        header: "Status",
        text: (row) => row.status,
        tone: (row) =>
          row.status === "active" ? "success" : row.status === "revoked" ? "danger" : "neutral",
      }),
      timeColumn({
        id: "lastUsedAt",
        header: "Last Used",
        value: (row) => (row.lastUsedAt ? new Date(row.lastUsedAt * 1000) : null),
        empty: "Never",
      }),
      timeColumn({
        id: "createdAt",
        header: "Created",
        value: (row) => (row.createdAt ? new Date(row.createdAt * 1000) : null),
      }),
    ],
    [],
  );

  const logColumns = useMemo<ColumnDef<(typeof logs)[0]>[]>(
    () => [
      timeColumn({
        id: "time",
        header: "Time",
        value: (row) => (row.createdAt ? new Date(row.createdAt * 1000) : null),
      }),
      codeColumn({
        id: "connectionId",
        header: "Connection",
        value: (row) => row.connectionId,
        copyable: true,
      }),
      objectColumn({
        id: "route",
        header: "Route",
        title: (row) => row.routeGroup,
      }),
      {
        id: "method",
        header: "Method",
        cell: ({ row }) => row.original.method,
      },
      statusColumn({
        id: "status",
        header: "Status",
        text: (row) => (row.statusCode ? String(row.statusCode) : "Pending"),
        tone: (row) => {
          if (!row.statusCode) return "neutral";
          if (row.statusCode >= 200 && row.statusCode < 300) return "success";
          if (row.statusCode >= 400 && row.statusCode < 500) return "warning";
          return "danger";
        },
        detail: (row) => row.error ?? null,
      }),
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <DashboardActionBar>
        <Button
          onClick={() => {
            void connectionsQuery.refetch();
            void logsQuery.refetch();
          }}
          variant="outline"
        >
          Refresh
        </Button>
      </DashboardActionBar>
      {connectionsQuery.isLoading || logsQuery.isLoading ? (
        <DashboardNotice title="Loading">
          Collecting the latest token and request telemetry.
        </DashboardNotice>
      ) : null}
      {connectionsQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{connectionsQuery.error.message}</DashboardNotice>
      ) : null}
      {logsQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{logsQuery.error.message}</DashboardNotice>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Recent Connections
        </h2>
        <DataTable
          columns={connectionColumns}
          data={recentConnections}
          isLoading={connectionsQuery.isLoading}
          error={connectionsQuery.error instanceof Error ? connectionsQuery.error : null}
          onRetry={() => void connectionsQuery.refetch()}
          empty={{ title: "No connections", description: "No issued tokens are available yet." }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Recent Logs
        </h2>
        <DataTable
          columns={logColumns}
          data={recentLogs}
          isLoading={logsQuery.isLoading}
          error={logsQuery.error instanceof Error ? logsQuery.error : null}
          onRetry={() => void logsQuery.refetch()}
          empty={{ title: "No logs", description: "No request logs have been recorded yet." }}
        />
      </section>
    </div>
  );
}
