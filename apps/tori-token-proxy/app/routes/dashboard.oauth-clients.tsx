import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  DashboardActionBar,
  DashboardField,
  DashboardNotice,
  DashboardPanel,
  DashboardResult,
  DashboardTable,
} from "~/components/dashboard-ui";
import {
  apiRequest,
  oauthClientCreatedSchema,
  oauthClientsListSchema,
  proxyPoliciesListSchema,
  type TokenProxyWebError,
} from "~/lib/api";

const DEFAULT_SCOPES = "proxy account";

export const Route = createFileRoute("/dashboard/oauth-clients")({
  component: DashboardOAuthClientsPage,
});

function formatDate(epochSeconds: number | null | undefined) {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleString();
}

function DashboardOAuthClientsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("OAuth Client");
  const [redirectUri, setRedirectUri] = useState("");
  const [scopes, setScopes] = useState(DEFAULT_SCOPES);
  const [policyId, setPolicyId] = useState("");
  const [createdClient, setCreatedClient] = useState<null | {
    clientId: string;
    clientSecret: string;
    clientName: string;
    redirectUris: string[];
    scopes: string[];
    policyId: string | null;
  }>(null);

  const clientsQuery = useQuery({
    queryKey: ["token-proxy", "oauth-clients"],
    queryFn: () =>
      apiRequest("/admin/oauth/clients").then((payload) => oauthClientsListSchema.parse(payload)),
  });
  const policiesQuery = useQuery({
    queryKey: ["token-proxy", "proxy-policies"],
    queryFn: () =>
      apiRequest("/admin/proxy/policies").then((payload) => proxyPoliciesListSchema.parse(payload)),
  });

  const createClientMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/admin/oauth/clients", {
        method: "POST",
        body: JSON.stringify({
          name,
          redirectUris: [redirectUri],
          scopes: scopes.split(/[,\s]+/).filter(Boolean),
          policyId: policyId || null,
        }),
      }).then((payload) => oauthClientCreatedSchema.parse(payload)),
    onSuccess: (client) => {
      setCreatedClient({
        clientId: client.client_id,
        clientSecret: client.client_secret,
        clientName: client.client_name,
        redirectUris: client.redirect_uris,
        scopes: client.scopes,
        policyId: client.policy_id ?? null,
      });
      setName("OAuth Client");
      setRedirectUri("");
      setScopes(DEFAULT_SCOPES);
      setPolicyId("");
      void queryClient.invalidateQueries({ queryKey: ["token-proxy", "oauth-clients"] });
    },
  });

  const clients = clientsQuery.data?.items ?? [];
  const policies = policiesQuery.data?.items ?? [];
  const policyNames = new Map(policies.map((policy) => [policy.id, policy.name]));
  const createError = createClientMutation.error as TokenProxyWebError | null;

  return (
    <div className="space-y-4">
      <DashboardActionBar>
        <Button type="button" variant="outline" onClick={() => void clientsQuery.refetch()}>
          Refresh
        </Button>
        <Button
          type="button"
          onClick={() => {
            setCreatedClient(null);
            setCreateOpen(true);
          }}
        >
          Create OAuth Client
        </Button>
      </DashboardActionBar>

      {clientsQuery.isLoading ? (
        <DashboardNotice title="Loading">Fetching OAuth clients.</DashboardNotice>
      ) : null}
      {clientsQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{clientsQuery.error.message}</DashboardNotice>
      ) : null}
      {policiesQuery.error instanceof Error ? (
        <DashboardNotice tone="error">{policiesQuery.error.message}</DashboardNotice>
      ) : null}

      <DashboardPanel
        eyebrow="Client registry"
        title="OAuth Clients"
        description="Applications registered to use this token-proxy as an OAuth authorization server."
      >
        <DashboardTable
          columns={["Created", "Name", "Client ID", "Policy", "Redirect URIs", "Scopes"]}
          rows={clients.map((client) => [
            formatDate(client.created_at),
            client.client_name,
            <code key={`${client.client_id}-id`} className="break-all text-xs">
              {client.client_id}
            </code>,
            client.policy_id ? (policyNames.get(client.policy_id) ?? client.policy_id) : "—",
            <pre
              key={`${client.client_id}-redirects`}
              className="whitespace-pre-wrap break-all text-xs"
            >
              {client.redirect_uris.join("\n")}
            </pre>,
            client.scopes.join(" "),
          ])}
          rowIds={clients.map((client) => client.client_id)}
          empty="No OAuth clients have been created yet."
        />
      </DashboardPanel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="normal-case">Create OAuth Client</DialogTitle>
            <DialogDescription>
              Register a client application that will start the OAuth authorization code flow.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <DashboardField label="Client name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </DashboardField>
            <DashboardField label="Scopes" hint="Separate scopes with spaces or commas.">
              <Input value={scopes} onChange={(event) => setScopes(event.target.value)} />
            </DashboardField>
            <DashboardField
              label="Proxy policy"
              hint="Required for client-bound proxy tokens to pass allowlist checks."
            >
              <select
                value={policyId}
                onChange={(event) => setPolicyId(event.target.value)}
                className="h-10 border-b border-input bg-transparent text-sm outline-none"
              >
                <option value="">No policy</option>
                {policies.map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.name}
                  </option>
                ))}
              </select>
            </DashboardField>
            <div className="md:col-span-2">
              <DashboardField
                label="Redirect URI"
                hint="Use the exact OAuth callback URL owned by the client application."
              >
                <Input
                  value={redirectUri}
                  placeholder="https://app.example.com/oauth/callback"
                  onChange={(event) => setRedirectUri(event.target.value)}
                />
              </DashboardField>
            </div>
          </div>

          {createError ? (
            <DashboardNotice title="Client creation failed" tone="error">
              {createError.message}
            </DashboardNotice>
          ) : null}

          {createdClient ? (
            <DashboardPanel
              eyebrow="Created client"
              title={createdClient.clientName}
              description="Copy the client secret now. It is only shown after creation and is not returned by the client list API."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <DashboardResult title="Client ID" value={createdClient.clientId} />
                <DashboardResult title="Client Secret" value={createdClient.clientSecret} />
                <DashboardResult
                  title="Proxy Policy"
                  value={
                    createdClient.policyId
                      ? (policyNames.get(createdClient.policyId) ?? createdClient.policyId)
                      : "No policy"
                  }
                />
                <DashboardResult
                  title="Redirect URI"
                  value={createdClient.redirectUris.join("\n")}
                />
                <DashboardResult title="Scopes" value={createdClient.scopes.join(" ")} />
              </div>
            </DashboardPanel>
          ) : null}

          <DashboardActionBar>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={!name || !redirectUri || createClientMutation.isPending}
              onClick={() => createClientMutation.mutate()}
            >
              {createClientMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DashboardActionBar>
        </DialogContent>
      </Dialog>
    </div>
  );
}
