import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import {
  DataTable,
  objectColumn,
  statusColumn,
  timeColumn,
  codeColumn,
  metadataColumn,
  actionsColumn,
} from "@repo/data-table";
import {
  DashboardActionBar,
  DashboardField,
  DashboardNotice,
  DashboardResult,
  DashboardStatusPill,
} from "~/components/dashboard-ui";
import {
  apiRequest,
  connectSessionSchema,
  connectionSchema,
  connectionsListSchema,
  providersListSchema,
  reconnectSessionSchema,
} from "~/lib/api";

const DEFAULT_PERMISSIONS = ["proxy", "account"];
const STATUS_OPTIONS = ["active", "revoked"] as const;

export const Route = createFileRoute("/dashboard/tokens")({
  component: DashboardTokensPage,
});

function formatDate(epochSeconds: number | null | undefined) {
  if (!epochSeconds) return "Never";
  return new Date(epochSeconds * 1000).toLocaleString();
}

function getConnectionStatusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "revoked") return "danger" as const;
  return "neutral" as const;
}

function getFlowStatusTone(status: string) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "expired") return "warning" as const;
  return "neutral" as const;
}

function permissionOptionsForProvider(provider: string, currentPermissions: string[] = []) {
  const defaults =
    provider === "steam" ? ["proxy", "account", "steam-family"] : ["proxy", "account"];
  return [...new Set([...defaults, ...currentPermissions])];
}

function DashboardTokensPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<null | {
    id: string;
    provider: string;
    displayName: string;
    label: string;
    permissions: string[];
    status: string;
  }>(null);
  const [connecting, setConnecting] = useState<null | {
    provider: string;
    label: string;
    permissions: string[];
    sessionId: string | null;
  }>(null);
  const [reconnecting, setReconnecting] = useState<null | {
    connectionId: string;
    provider: string;
    displayName: string;
    sessionId: string | null;
  }>(null);

  const providersQuery = useQuery({
    queryKey: ["token-proxy", "providers"],
    queryFn: () =>
      apiRequest("/admin/providers").then((payload) => providersListSchema.parse(payload)),
  });
  const connectionsQuery = useQuery({
    queryKey: ["token-proxy", "connections"],
    queryFn: () =>
      apiRequest("/admin/connections").then((payload) => connectionsListSchema.parse(payload)),
  });

  const updateMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/admin/connections/${editing?.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: editing?.displayName ?? null,
          label: editing?.label ?? null,
          permissions: editing?.permissions ?? DEFAULT_PERMISSIONS,
          status: editing?.status ?? "active",
        }),
      }).then((payload) => connectionSchema.parse(payload)),
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["token-proxy", "connections"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/admin/connections/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["token-proxy", "connections"] });
    },
  });

  const startConnectMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/admin/connections/connect", {
        method: "POST",
        body: JSON.stringify({
          provider: connecting?.provider,
          label: connecting?.label || null,
          permissions: connecting?.permissions,
        }),
      }).then((payload) => connectSessionSchema.parse(payload)),
    onSuccess: (session) => {
      setConnecting((current) =>
        current
          ? {
              ...current,
              provider: session.provider,
              sessionId: session.id,
            }
          : current,
      );
    },
  });

  const connectSessionQuery = useQuery({
    queryKey: ["token-proxy", "connect-session", connecting?.sessionId],
    queryFn: async () =>
      apiRequest(`/admin/connections/connect/${connecting?.sessionId}`).then((payload) =>
        connectSessionSchema.parse(payload),
      ),
    enabled: Boolean(connecting?.sessionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const intervalSeconds = Number.parseInt(query.state.data?.pollIntervalSeconds ?? "5", 10);
      return status === "pending" ? Math.max(2000, intervalSeconds * 1000) : false;
    },
  });

  const startReconnectMutation = useMutation({
    mutationFn: async (connectionId: string) =>
      apiRequest(`/admin/connections/${connectionId}/reconnect`, {
        method: "POST",
      }).then((payload) => reconnectSessionSchema.parse(payload)),
    onSuccess: (session) => {
      setReconnecting((current) =>
        current
          ? {
              ...current,
              sessionId: session.id,
              provider: session.provider,
              displayName: session.displayName ?? current.displayName,
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["token-proxy", "connections"] });
    },
  });

  const reconnectSessionQuery = useQuery({
    queryKey: [
      "token-proxy",
      "reconnect-session",
      reconnecting?.connectionId,
      reconnecting?.sessionId,
    ],
    queryFn: async () =>
      apiRequest(
        `/admin/connections/${reconnecting?.connectionId}/reconnect/${reconnecting?.sessionId}`,
      ).then((payload) => reconnectSessionSchema.parse(payload)),
    enabled: Boolean(reconnecting?.connectionId && reconnecting?.sessionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const intervalSeconds = Number.parseInt(query.state.data?.pollIntervalSeconds ?? "5", 10);
      return status === "pending" ? Math.max(2000, intervalSeconds * 1000) : false;
    },
  });

  const rows = useMemo(() => connectionsQuery.data?.items ?? [], [connectionsQuery.data]);
  const providers = providersQuery.data?.items ?? [];
  const connectView = connectSessionQuery.data ?? startConnectMutation.data ?? null;

  const columns = useMemo<ColumnDef<(typeof rows)[0]>[]>(
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
      metadataColumn({
        id: "permissions",
        header: "Permissions",
        value: (row) => (
          <div className="flex flex-wrap gap-1">
            {(row.permissions ?? []).length ? (
              (row.permissions ?? []).map((p) => (
                <span
                  key={p}
                  className="rounded bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground border border-border/40"
                >
                  {p}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </div>
        ),
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
      codeColumn({
        id: "token",
        header: "Preview Token",
        value: (row) => row.apiKeyPreview ?? row.apiKey.slice(0, 12),
      }),
      actionsColumn({
        id: "actions",
        items: (row) => [
          {
            label: "Edit",
            onSelect: () =>
              setEditing({
                id: row.id,
                provider: row.provider,
                displayName: row.displayName ?? "",
                label: row.label ?? "",
                permissions: row.permissions ?? permissionOptionsForProvider(row.provider),
                status: row.status,
              }),
          },
          {
            label: "Reconnect",
            onSelect: () => {
              setReconnecting({
                connectionId: row.id,
                provider: row.provider,
                displayName: row.displayName ?? "",
                sessionId: null,
              });
              startReconnectMutation.mutate(row.id);
            },
          },
          {
            label: "Revoke",
            variant: "destructive",
            onSelect: () => revokeMutation.mutate(row.id),
          },
        ],
      }),
    ],
    [startReconnectMutation, revokeMutation],
  );

  useEffect(() => {
    if (connectSessionQuery.data?.status === "completed" && connectSessionQuery.data.connection) {
      void queryClient.invalidateQueries({ queryKey: ["token-proxy", "connections"] });
    }
  }, [connectSessionQuery.data, queryClient]);

  return (
    <div className="space-y-4">
      <DashboardActionBar>
        <Button
          onClick={() => {
            const provider = providers[0]?.name ?? "steam";
            setConnecting({
              provider,
              label: "",
              permissions: permissionOptionsForProvider(provider),
              sessionId: null,
            });
            startConnectMutation.reset();
          }}
          disabled={providersQuery.isLoading}
        >
          Add Connection
        </Button>
        <Button onClick={() => void connectionsQuery.refetch()} variant="outline">
          Refresh
        </Button>
      </DashboardActionBar>

      {providersQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{providersQuery.error.message}</DashboardNotice>
      ) : null}
      {connectionsQuery.isLoading ? (
        <DashboardNotice title="Loading">
          Fetching the latest issued token registry.
        </DashboardNotice>
      ) : null}
      {connectionsQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{connectionsQuery.error.message}</DashboardNotice>
      ) : null}
      {updateMutation.error instanceof Error ? (
        <DashboardNotice tone="error">{updateMutation.error.message}</DashboardNotice>
      ) : null}
      {revokeMutation.error instanceof Error ? (
        <DashboardNotice tone="error">{revokeMutation.error.message}</DashboardNotice>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={connectionsQuery.isLoading}
        error={connectionsQuery.error instanceof Error ? connectionsQuery.error : null}
        onRetry={() => void connectionsQuery.refetch()}
        empty={{ title: "No tokens", description: "No issued tokens are available yet." }}
      />

      <Dialog open={Boolean(connecting)} onOpenChange={(open) => !open && setConnecting(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="normal-case">Add Connection</DialogTitle>
            <DialogDescription>
              Authenticate the provider account and issue a managed API key.
            </DialogDescription>
          </DialogHeader>
          {connecting ? (
            connectView ? (
              <div className="space-y-5">
                {startConnectMutation.error instanceof Error ? (
                  <DashboardNotice tone="error">
                    {startConnectMutation.error.message}
                  </DashboardNotice>
                ) : null}
                {connectSessionQuery.error instanceof Error ? (
                  <DashboardNotice tone="error">
                    {connectSessionQuery.error.message}
                  </DashboardNotice>
                ) : null}
                {connectView.errorMessage ? (
                  <DashboardNotice tone="error">{connectView.errorMessage}</DashboardNotice>
                ) : null}
                {connectView.status === "completed" && connectView.connection ? (
                  <DashboardNotice title="Connection Ready" tone="success">
                    {connectView.connection.displayName} is connected and the API key has been
                    issued.
                  </DashboardNotice>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5">
                    <div className="flex min-h-80 items-center justify-center border bg-muted/20 p-6">
                      {connectView.verificationUri ? (
                        <div className="border bg-white p-4 shadow-sm">
                          <QRCodeSVG
                            key={connectView.verificationUri}
                            value={connectView.verificationUri}
                            size={220}
                            bgColor="#ffffff"
                            fgColor="#171411"
                            includeMargin
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Waiting for the provider to expose a verification URI.
                        </p>
                      )}
                    </div>
                    <DashboardResult
                      title="Verification URI"
                      value={connectView.verificationUri ?? "No verification URI available yet."}
                    />
                    {connectView.apiKey ? (
                      <DashboardResult title="Issued API Key" value={connectView.apiKey} />
                    ) : null}
                  </div>

                  <div className="space-y-4 border bg-card p-5">
                    <DashboardField label="Status">
                      <div className="border-b border-input py-2">
                        <DashboardStatusPill
                          text={connectView.status}
                          tone={getFlowStatusTone(connectView.status)}
                        />
                      </div>
                    </DashboardField>
                    <DashboardField label="Provider">
                      <div className="border-b border-input py-2 text-sm text-muted-foreground">
                        {connectView.provider}
                      </div>
                    </DashboardField>
                    <DashboardField label="Expires At">
                      <div className="border-b border-input py-2 text-sm text-muted-foreground">
                        {new Date(connectView.expiresAt).toLocaleString()}
                      </div>
                    </DashboardField>
                    <DashboardField label="Display Name">
                      <div className="border-b border-input py-2 text-sm text-muted-foreground">
                        {connectView.displayName ?? "—"}
                      </div>
                    </DashboardField>
                    {connectView.connection ? (
                      <DashboardField label="Connection ID">
                        <div className="border-b border-input py-2 text-sm text-muted-foreground">
                          {connectView.connection.id}
                        </div>
                      </DashboardField>
                    ) : null}
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" onClick={() => setConnecting(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form
                className="grid gap-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  startConnectMutation.mutate();
                }}
              >
                <DashboardField label="Provider">
                  <div className="flex flex-wrap gap-2">
                    {providers.map((provider) => (
                      <Button
                        key={provider.name}
                        type="button"
                        size="xs"
                        variant={connecting.provider === provider.name ? "default" : "outline"}
                        onClick={() =>
                          setConnecting((current) =>
                            current
                              ? {
                                  ...current,
                                  provider: provider.name,
                                  permissions: permissionOptionsForProvider(provider.name),
                                }
                              : current,
                          )
                        }
                      >
                        {provider.displayName}
                      </Button>
                    ))}
                  </div>
                </DashboardField>
                <DashboardField label="Label">
                  <Input
                    value={connecting.label}
                    onChange={(event) =>
                      setConnecting((current) =>
                        current ? { ...current, label: event.target.value } : current,
                      )
                    }
                  />
                </DashboardField>
                <DashboardField label="Permissions">
                  <div className="flex flex-wrap gap-2">
                    {permissionOptionsForProvider(connecting.provider, connecting.permissions).map(
                      (permission) => {
                        const selected = connecting.permissions.includes(permission);
                        return (
                          <Button
                            key={permission}
                            type="button"
                            size="xs"
                            variant={selected ? "default" : "outline"}
                            onClick={() =>
                              setConnecting((current) => {
                                if (!current) return current;
                                const hasPermission = current.permissions.includes(permission);
                                const permissions = hasPermission
                                  ? current.permissions.filter((value) => value !== permission)
                                  : [...current.permissions, permission];
                                return {
                                  ...current,
                                  permissions: permissions.length ? permissions : [permission],
                                };
                              })
                            }
                          >
                            {permission}
                          </Button>
                        );
                      },
                    )}
                  </div>
                </DashboardField>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setConnecting(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={startConnectMutation.isPending}>
                    {startConnectMutation.isPending ? "Starting..." : "Start Connect"}
                  </Button>
                </div>
              </form>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="normal-case">Edit Credential</DialogTitle>
            <DialogDescription>
              Update the operator-facing label, allowed scopes, and status for this issued token.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form
              className="grid gap-6 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                updateMutation.mutate();
              }}
            >
              <DashboardField label="Connection ID">
                <div className="border-b border-input py-2 text-sm text-muted-foreground">
                  {editing.id}
                </div>
              </DashboardField>
              <DashboardField label="Status Preview">
                <div className="border-b border-input py-2">
                  <DashboardStatusPill
                    text={editing.status}
                    tone={getConnectionStatusTone(editing.status)}
                  />
                </div>
              </DashboardField>
              <DashboardField label="Display Name">
                <Input
                  value={editing.displayName}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, displayName: event.target.value } : current,
                    )
                  }
                />
              </DashboardField>
              <DashboardField label="Label">
                <Input
                  value={editing.label}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, label: event.target.value } : current,
                    )
                  }
                />
              </DashboardField>
              <DashboardField label="Permissions">
                <div className="flex flex-wrap gap-2">
                  {permissionOptionsForProvider(editing.provider, editing.permissions).map(
                    (permission) => {
                      const selected = editing.permissions.includes(permission);
                      return (
                        <Button
                          key={permission}
                          type="button"
                          size="xs"
                          variant={selected ? "default" : "outline"}
                          onClick={() =>
                            setEditing((current) => {
                              if (!current) return current;
                              const hasPermission = current.permissions.includes(permission);
                              const permissions = hasPermission
                                ? current.permissions.filter((value) => value !== permission)
                                : [...current.permissions, permission];
                              return {
                                ...current,
                                permissions: permissions.length ? permissions : [permission],
                              };
                            })
                          }
                        >
                          {permission}
                        </Button>
                      );
                    },
                  )}
                </div>
              </DashboardField>
              <DashboardField label="Status">
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="xs"
                      variant={editing.status === status ? "default" : "outline"}
                      onClick={() =>
                        setEditing((current) => (current ? { ...current, status } : current))
                      }
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </DashboardField>
              <div className="md:col-span-2 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reconnecting)} onOpenChange={(open) => !open && setReconnecting(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="normal-case">Reconnect Provider Session</DialogTitle>
            <DialogDescription>
              Re-authorize this credential inside token-proxy. The existing API key remains
              unchanged for downstream clients.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {startReconnectMutation.isPending && !reconnecting?.sessionId ? (
              <DashboardNotice title="Starting">Creating a new reconnect session.</DashboardNotice>
            ) : null}
            {startReconnectMutation.error instanceof Error ? (
              <DashboardNotice tone="error">{startReconnectMutation.error.message}</DashboardNotice>
            ) : null}
            {reconnectSessionQuery.error instanceof Error ? (
              <DashboardNotice tone="error">{reconnectSessionQuery.error.message}</DashboardNotice>
            ) : null}

            {reconnectSessionQuery.data ? (
              <>
                {reconnectSessionQuery.data.errorMessage ? (
                  <DashboardNotice tone="error">
                    {reconnectSessionQuery.data.errorMessage}
                  </DashboardNotice>
                ) : null}
                {reconnectSessionQuery.data.status === "completed" ? (
                  <DashboardNotice title="Reconnect Complete" tone="success">
                    Reconnected as{" "}
                    {reconnectSessionQuery.data.displayName ??
                      reconnecting?.displayName ??
                      "operator"}
                    .
                  </DashboardNotice>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-5">
                    <div className="flex min-h-80 items-center justify-center border bg-muted/20 p-6">
                      {reconnectSessionQuery.data.verificationUri ? (
                        <div className="border bg-white p-4 shadow-sm">
                          <QRCodeSVG
                            key={reconnectSessionQuery.data.verificationUri}
                            value={reconnectSessionQuery.data.verificationUri}
                            size={220}
                            bgColor="#ffffff"
                            fgColor="#171411"
                            includeMargin
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Waiting for the provider to expose a verification URI.
                        </p>
                      )}
                    </div>
                    <DashboardResult
                      title="Verification URI"
                      value={
                        reconnectSessionQuery.data.verificationUri ??
                        "No verification URI available yet."
                      }
                    />
                  </div>

                  <div className="space-y-4 border bg-card p-5">
                    <DashboardField label="Status">
                      <div className="border-b border-input py-2">
                        <DashboardStatusPill
                          text={reconnectSessionQuery.data.status}
                          tone={getFlowStatusTone(reconnectSessionQuery.data.status)}
                        />
                      </div>
                    </DashboardField>
                    <DashboardField label="Provider">
                      <div className="border-b border-input py-2 text-sm text-muted-foreground">
                        {reconnectSessionQuery.data.provider}
                      </div>
                    </DashboardField>
                    <DashboardField label="Expires At">
                      <div className="border-b border-input py-2 text-sm text-muted-foreground">
                        {new Date(reconnectSessionQuery.data.expiresAt).toLocaleString()}
                      </div>
                    </DashboardField>
                    <DashboardField label="Resolved Display Name">
                      <div className="border-b border-input py-2 text-sm text-muted-foreground">
                        {reconnectSessionQuery.data.displayName ?? reconnecting?.displayName ?? "—"}
                      </div>
                    </DashboardField>
                    <DashboardField label="Connection">
                      <div className="border-b border-input py-2 text-sm text-muted-foreground">
                        {reconnecting?.connectionId ?? "—"}
                      </div>
                    </DashboardField>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
