import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@repo/ui/components/button";
import { DashboardNotice, DashboardPanel, DashboardStatusPill } from "~/components/dashboard-ui";
import {
  apiRequest,
  externalConnectConfirmResponseSchema,
  externalConnectSessionSchema,
} from "~/lib/api";

export const Route = createFileRoute("/external-connect/$sid")({
  component: ExternalConnectPage,
});

function getStatusTone(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "expired") return "warning" as const;
  return "neutral" as const;
}

function ExternalConnectPage() {
  const { sid } = Route.useParams();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [newAuthStarted, setNewAuthStarted] = useState(false);

  const sessionQuery = useQuery({
    queryKey: ["token-proxy", "external-connect", sid],
    queryFn: () =>
      apiRequest(`/admin/external-connect/${sid}`).then((payload) =>
        externalConnectSessionSchema.parse(payload),
      ),
    refetchInterval: (query) => {
      if (!newAuthStarted) return false;
      const status = query.state.data?.status;
      const intervalSeconds = Number.parseInt(query.state.data?.pollIntervalSeconds ?? "5", 10);
      return status === "pending" ? Math.max(2000, intervalSeconds * 1000) : false;
    },
  });

  const session = sessionQuery.data ?? null;
  const connections = useMemo(() => session?.connections ?? [], [session?.connections]);
  const selectedConnection = connections.find(
    (connection) => connection.id === selectedConnectionId,
  );

  useEffect(() => {
    if (!selectedConnectionId && connections[0]) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections, selectedConnectionId]);

  const startNew = useMutation({
    mutationFn: async (state: string) =>
      apiRequest(`/admin/external-connect/${sid}/new`, {
        method: "POST",
        body: JSON.stringify({ state }),
      }).then((payload) => externalConnectSessionSchema.parse(payload)),
    onSuccess: () => {
      setNewAuthStarted(true);
      void sessionQuery.refetch();
    },
  });

  const confirm = useMutation({
    mutationFn: async (input: { state: string; connectionId?: string }) =>
      apiRequest(`/admin/external-connect/${sid}/confirm`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((payload) => externalConnectConfirmResponseSchema.parse(payload)),
    onSuccess: (payload) => {
      window.location.href = payload.redirectUrl;
    },
  });

  if (sessionQuery.isLoading) {
    return <ExternalConnectShell>Loading connection session</ExternalConnectShell>;
  }

  if (sessionQuery.error || !session) {
    const message =
      sessionQuery.error instanceof Error ? sessionQuery.error.message : "Session not found";
    return (
      <ExternalConnectShell>
        <DashboardNotice title="Connection unavailable" tone="error">
          {message}
        </DashboardNotice>
      </ExternalConnectShell>
    );
  }

  const state = new URLSearchParams(window.location.search).get("state") ?? "";

  return (
    <ExternalConnectShell>
      <DashboardPanel
        eyebrow="External Connect"
        title={`Connect ${session.provider}`}
        description="Choose an existing token-proxy token first. Create a new token only when the account is not already available."
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <DashboardStatusPill text={session.status} tone={getStatusTone(session.status)} />
            <p className="text-sm text-muted-foreground">
              Expires {new Date(session.expiresAt).toLocaleString()}
            </p>
          </div>

          {session.errorMessage ? (
            <DashboardNotice title="Connection failed" tone="error">
              {session.errorMessage}
            </DashboardNotice>
          ) : null}

          {!newAuthStarted && session.status === "pending" ? (
            <div className="space-y-4">
              {connections.length ? (
                <div className="space-y-3">
                  {connections.map((connection) => (
                    <label
                      key={connection.id}
                      className="flex cursor-pointer items-start gap-3 border border-border/70 bg-card p-4"
                    >
                      <input
                        type="radio"
                        name="connection"
                        className="mt-1"
                        checked={selectedConnectionId === connection.id}
                        onChange={() => setSelectedConnectionId(connection.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">
                          {connection.displayName || connection.providerUid}
                        </span>
                        <span className="mt-1 block break-words text-sm text-muted-foreground">
                          {[connection.providerUid, connection.label, connection.apiKeyPreview]
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      </span>
                    </label>
                  ))}
                  <Button
                    type="button"
                    disabled={!selectedConnection || confirm.isPending}
                    onClick={() => {
                      if (!selectedConnection) return;
                      confirm.mutate({ state, connectionId: selectedConnection.id });
                    }}
                  >
                    Use selected token
                  </Button>
                </div>
              ) : (
                <DashboardNotice title="No existing token">
                  No active token-proxy token is available for this provider.
                </DashboardNotice>
              )}

              <Button
                type="button"
                variant={connections.length ? "outline" : "default"}
                disabled={startNew.isPending}
                onClick={() => startNew.mutate(state)}
              >
                Use a new token
              </Button>
            </div>
          ) : null}

          {newAuthStarted && session.status === "pending" ? (
            <div className="space-y-4">
              {session.verificationUri ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <QRCodeSVG value={session.verificationUri} size={168} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Open the provider verification URL and complete authorization.
                    </p>
                    <a
                      href={session.verificationUri}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {session.verificationUri}
                    </a>
                  </div>
                </div>
              ) : (
                <DashboardNotice>Waiting for provider authorization.</DashboardNotice>
              )}
            </div>
          ) : null}

          {session.status === "completed" ? (
            <div className="space-y-4">
              <DashboardNotice title="Authorization completed" tone="success">
                Confirm this account to finish the Tori connection.
              </DashboardNotice>
              <div className="border border-border/70 p-4">
                <p className="font-medium text-foreground">
                  {session.displayName || session.providerUid || session.provider}
                </p>
                {session.providerUid ? (
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {session.providerUid}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate({ state })}
              >
                Confirm connection
              </Button>
            </div>
          ) : null}

          {confirm.error ? (
            <DashboardNotice title="Confirm failed" tone="error">
              {confirm.error instanceof Error ? confirm.error.message : "Confirm failed"}
            </DashboardNotice>
          ) : null}
          {startNew.error ? (
            <DashboardNotice title="Authorization failed" tone="error">
              {startNew.error instanceof Error ? startNew.error.message : "Authorization failed"}
            </DashboardNotice>
          ) : null}
        </div>
      </DashboardPanel>
    </ExternalConnectShell>
  );
}

function ExternalConnectShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl items-center px-6 py-10 text-foreground">
      <div className="w-full">{children}</div>
    </main>
  );
}
