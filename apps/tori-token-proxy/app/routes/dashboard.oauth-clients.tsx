import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import {
  DashboardActionBar,
  DashboardField,
  DashboardNotice,
  DashboardPanel,
  DashboardResult,
} from "~/components/dashboard-ui";
import { apiRequest, oauthClientCreatedSchema } from "~/lib/api";

const DEFAULT_SCOPES = "proxy account";

export const Route = createFileRoute("/dashboard/oauth-clients")({
  component: DashboardOAuthClientsPage,
});

function DashboardOAuthClientsPage() {
  const [name, setName] = useState("Tori");
  const [redirectUri, setRedirectUri] = useState("");
  const [scopes, setScopes] = useState(DEFAULT_SCOPES);
  const [createdClient, setCreatedClient] = useState<null | {
    clientId: string;
    clientSecret: string;
    clientName: string;
    redirectUris: string[];
    scopes: string[];
  }>(null);

  const createClientMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/admin/oauth/clients", {
        method: "POST",
        body: JSON.stringify({
          name,
          redirectUris: [redirectUri],
          scopes: scopes.split(/[,\s]+/).filter(Boolean),
        }),
      }).then((payload) => oauthClientCreatedSchema.parse(payload)),
    onSuccess: (client) => {
      setCreatedClient({
        clientId: client.client_id,
        clientSecret: client.client_secret,
        clientName: client.client_name,
        redirectUris: client.redirect_uris,
        scopes: client.scopes,
      });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <DashboardPanel
        eyebrow="Client registration"
        title="Create OAuth client"
        description="Generate client credentials for an application that will use this token-proxy as an authorization server."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <DashboardField label="Client name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </DashboardField>
          <DashboardField label="Scopes" hint="Separate scopes with spaces or commas.">
            <Input value={scopes} onChange={(event) => setScopes(event.target.value)} />
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

        <DashboardActionBar>
          <Button
            type="button"
            disabled={!redirectUri || createClientMutation.isPending}
            onClick={() => createClientMutation.mutate()}
          >
            {createClientMutation.isPending ? "Creating..." : "Create OAuth Client"}
          </Button>
        </DashboardActionBar>
      </DashboardPanel>

      {createClientMutation.error ? (
        <DashboardNotice title="Client creation failed" tone="error">
          {createClientMutation.error instanceof Error
            ? createClientMutation.error.message
            : "Unable to create OAuth client"}
        </DashboardNotice>
      ) : null}

      {createdClient ? (
        <DashboardPanel
          eyebrow="Created client"
          title={createdClient.clientName}
          description="Use these values in the client application that will start the authorization flow."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardResult title="Client ID" value={createdClient.clientId} />
            <DashboardResult title="Client Secret" value={createdClient.clientSecret} />
            <DashboardResult title="Redirect URI" value={createdClient.redirectUris.join("\n")} />
            <DashboardResult title="Scopes" value={createdClient.scopes.join(" ")} />
          </div>
        </DashboardPanel>
      ) : null}
    </div>
  );
}
