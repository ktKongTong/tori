import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { DashboardField, DashboardNotice } from "~/components/dashboard-ui";
import { apiRequest } from "~/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async () =>
      apiRequest<{ authenticated: boolean }>("/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ adminKey }),
      }),
    onSuccess: () => {
      void navigate({ to: "/dashboard", replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Login failed");
    },
  });

  return (
    <main className="relative min-h-svh overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(15,23,42,0.02)_50%,transparent_100%)]" />
      <div className="relative mx-auto flex min-h-svh w-full max-w-6xl items-center px-6 py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <section className="space-y-6">
            <p className="font-mono text-[0.68rem] tracking-[0.26em] text-muted-foreground uppercase">
              Token Proxy
            </p>
            <h1 className="max-w-[12ch] font-serif text-[clamp(2.4rem,3vw+1rem,4.8rem)] leading-[0.96] tracking-[-0.04em] text-foreground">
              Admin Control Plane
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Sign in with the token-proxy admin key to inspect issued tokens, review request
              telemetry, reconnect Steam credentials, and revoke or scope credentials without
              touching raw persistence directly.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="border bg-card/80 px-5 py-5">
                <p className="font-mono text-[0.68rem] tracking-[0.26em] text-muted-foreground uppercase">
                  Issued Credentials
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Review provider identity, status, scopes, and last-used metadata from one table.
                </p>
              </div>
              <div className="border bg-card/80 px-5 py-5">
                <p className="font-mono text-[0.68rem] tracking-[0.26em] text-muted-foreground uppercase">
                  Request Telemetry
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Validate which connection invoked which route group, with response codes and
                  failure details.
                </p>
              </div>
            </div>
          </section>

          <Card className="gap-0 border border-border/70 py-0 shadow-none ring-0">
            <CardHeader className="gap-2 border-b px-5 py-4">
              <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
                Sign In
              </p>
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xl font-semibold tracking-tight normal-case">
                  Authenticate as proxy admin
                </CardTitle>
                <CardDescription>
                  The admin key is required before the dashboard can expose token or log data.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(null);
                  loginMutation.mutate();
                }}
              >
                <DashboardField
                  label="Admin Key"
                  hint="Matches the runtime secret configured for token-proxy administration."
                >
                  <Input
                    type="password"
                    value={adminKey}
                    onChange={(event) => setAdminKey(event.target.value)}
                    autoFocus
                  />
                </DashboardField>
                {error ? <DashboardNotice tone="error">{error}</DashboardNotice> : null}
                <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
