import { QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { useState } from "react";

import { TooltipProvider } from "@repo/ui/components/tooltip";
import { createQueryClient } from "~/lib/query-client";
import "../styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Token Proxy Dashboard" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => (
    <RouteStateView message="404" details="The requested page could not be found." />
  ),
  errorComponent: ({ error }) => {
    const details = error instanceof Error ? error.message : "An unexpected error occurred.";
    const stack = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;

    return <RouteStateView message="Error" details={details} stack={stack} />;
  },
});

function RootComponent() {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Outlet />
          </TooltipProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function RouteStateView({
  message,
  details,
  stack,
}: {
  message: string;
  details: string;
  stack?: string;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl items-center px-6 py-16">
      <div className="w-full border bg-card px-6 py-5 shadow-sm">
        <p className="dashboard-kicker">{message}</p>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">{details}</h1>
        {stack ? (
          <pre className="mt-6 overflow-x-auto whitespace-pre-wrap border bg-muted/30 p-4 text-xs leading-6 text-muted-foreground">
            <code>{stack}</code>
          </pre>
        ) : null}
      </div>
    </main>
  );
}
