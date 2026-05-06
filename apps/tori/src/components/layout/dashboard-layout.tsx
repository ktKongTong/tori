import { Navigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { DashboardSidebar } from "./dashboard-sidebar";
import { Separator } from "@repo/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { signOut, useSession } from "@/lib/auth-client";

const PAGE_META: Record<string, { title: string }> = {
  "/": {
    title: "Home",
  },
  "/bot": {
    title: "Playground",
  },
  "/binding": {
    title: "User Bindings",
  },
  "/binding/channels": {
    title: "Channel Bindings",
  },
  "/binding/claims": {
    title: "Claim Sessions",
  },
  "/integration": {
    title: "My Connections",
  },
  "/integration/proxies": {
    title: "Proxy Registry",
  },
  "/notify": {
    title: "My Subscriptions",
  },
  "/tasks": {
    title: "Tasks",
  },
  "/bot-instances": {
    title: "Bot Runtime",
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-6 text-foreground">
        <div className="border bg-card px-6 py-5 text-sm text-muted-foreground shadow-sm">
          Loading dashboard
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  const meta =
    PAGE_META[location.pathname] ??
    (location.pathname.startsWith("/tasks/") ? { title: "Task Detail" } : PAGE_META["/"]);
  const userLabel = `${session.user.name ?? "Operator"} · ${session.user.email}`;
  const role = (session.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = role.includes("admin");

  return (
    <SidebarProvider>
      <DashboardSidebar
        isAdmin={isAdmin}
        sessionLabel={userLabel}
        onSignOut={async () => {
          await signOut();
        }}
      />

      <SidebarInset className="min-w-0 h-svh overflow-hidden">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <Separator orientation="vertical" className="hidden h-4 md:block" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-foreground">{meta.title}</h1>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 w-full overflow-y-auto">
          <div className="mx-auto mt-4 w-full max-w-6xl px-4 pb-6 md:px-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
