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
import { apiRequest, systemTaskRunsListSchema, tokenRefreshLogsListSchema } from "~/lib/api";

export const Route = createFileRoute("/dashboard/refresh-logs")({
  component: DashboardRefreshLogsPage,
});

const PAGE_SIZE = 20;

function formatDate(epochSeconds: number | null | undefined) {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleString();
}

function getRefreshStatusTone(status: string) {
  if (status === "SUCCESS") return "success" as const;
  if (status === "FAIL") return "danger" as const;
  if (status === "SKIP") return "warning" as const;
  return "neutral" as const;
}

function DashboardRefreshLogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const refreshLogsQuery = useQuery({
    queryKey: ["token-proxy", "refresh-logs", page],
    queryFn: () =>
      apiRequest(`/admin/refresh-logs?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`).then(
        (payload) => tokenRefreshLogsListSchema.parse(payload),
      ),
  });

  const runRefreshTasksMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/admin/system/run-all", {
        method: "POST",
      }).then((payload) => systemTaskRunsListSchema.parse(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["token-proxy", "refresh-logs"] });
    },
  });

  const refreshLogs = refreshLogsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <DashboardActionBar>
        <Button onClick={() => void refreshLogsQuery.refetch()} variant="outline">
          Refresh
        </Button>
        <Button
          onClick={() => runRefreshTasksMutation.mutate()}
          disabled={runRefreshTasksMutation.isPending}
        >
          {runRefreshTasksMutation.isPending ? "Running..." : "Run Refresh Now"}
        </Button>
      </DashboardActionBar>

      {refreshLogsQuery.isLoading ? (
        <DashboardNotice title="Loading">Fetching refresh logs.</DashboardNotice>
      ) : null}
      {refreshLogsQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{refreshLogsQuery.error.message}</DashboardNotice>
      ) : null}
      {runRefreshTasksMutation.error instanceof Error ? (
        <DashboardNotice tone="error">{runRefreshTasksMutation.error.message}</DashboardNotice>
      ) : null}

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
        page={page}
        pageSize={PAGE_SIZE}
        itemCount={refreshLogs.length}
        onPageChange={setPage}
      />
    </div>
  );
}
