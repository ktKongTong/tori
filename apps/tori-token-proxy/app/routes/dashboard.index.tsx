import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@repo/ui/components/button";
import {
  DashboardActionBar,
  DashboardNotice,
  DashboardStatusPill,
  DashboardTable,
} from "~/components/dashboard-ui";
import { apiRequest, connectionsListSchema, requestLogsListSchema } from "~/lib/api";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverviewPage,
});

function formatDate(epochSeconds: number | null | undefined) {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleString();
}

function DashboardOverviewPage() {
  const connectionsQuery = useQuery({
    queryKey: ["token-proxy", "connections"],
    queryFn: () =>
      apiRequest("/admin/connections").then((payload) => connectionsListSchema.parse(payload)),
  });

  const logsQuery = useQuery({
    queryKey: ["token-proxy", "logs"],
    queryFn: () =>
      apiRequest("/admin/request-logs?limit=200").then((payload) =>
        requestLogsListSchema.parse(payload),
      ),
  });

  const connections = connectionsQuery.data?.items ?? [];
  const logs = logsQuery.data?.items ?? [];
  const recentConnections = [...connections].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const recentLogs = [...logs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);

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
        <DashboardTable
          columns={["Provider", "User", "Status", "Last Used", "Created"]}
          rows={recentConnections.map((connection) => [
            <div key={`${connection.id}-provider`} className="space-y-1">
              <p className="font-medium text-foreground">{connection.provider}</p>
              <p className="text-xs text-muted-foreground">{connection.providerUid}</p>
            </div>,
            connection.displayName,
            <DashboardStatusPill key={`${connection.id}-status`} text={connection.status} />,
            formatDate(connection.lastUsedAt),
            formatDate(connection.createdAt),
          ])}
          rowIds={recentConnections.map((connection) => connection.id)}
          empty="No issued tokens are available yet."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Recent Logs
        </h2>
        <DashboardTable
          columns={["Time", "Connection", "Route", "Method", "Status", "Error"]}
          rows={recentLogs.map((log) => [
            formatDate(log.createdAt),
            log.connectionId,
            log.routeGroup,
            log.method,
            <DashboardStatusPill
              key={`${log.id}-status`}
              text={log.statusCode ? String(log.statusCode) : "Pending"}
            />,
            log.error ?? "—",
          ])}
          rowIds={recentLogs.map((log) => String(log.id))}
          empty="No request logs have been recorded yet."
        />
      </section>
    </div>
  );
}
