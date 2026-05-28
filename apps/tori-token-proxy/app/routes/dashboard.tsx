import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";

import { Separator } from "@repo/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@repo/ui/components/sidebar";
import { DashboardSidebar } from "~/components/dashboard-sidebar";
import { adminSessionSchema, apiRequest } from "~/lib/api";

const META: Record<string, { title: string }> = {
  "/dashboard": {
    title: "Overview",
  },
  "/dashboard/tokens": {
    title: "Connections",
  },
  "/dashboard/logs": {
    title: "Request Logs",
  },
  "/dashboard/refresh-logs": {
    title: "Refresh Logs",
  },
  "/dashboard/oauth-clients": {
    title: "OAuth Clients",
  },
};

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ["token-proxy", "admin-session"],
    queryFn: () =>
      apiRequest("/admin/auth/session").then((payload) => adminSessionSchema.parse(payload)),
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () =>
      apiRequest<{ authenticated: boolean }>("/admin/auth/logout", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["token-proxy"] });
      void navigate({ to: "/login", replace: true });
    },
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-6 text-foreground">
        <div className="border bg-card px-6 py-5 text-sm text-muted-foreground shadow-sm">
          Loading dashboard
        </div>
      </div>
    );
  }

  if (sessionQuery.error) {
    return <Navigate to="/login" replace />;
  }

  const meta = META[location.pathname] ?? META["/dashboard"];

  return (
    <SidebarProvider>
      <DashboardSidebar onSignOut={() => logoutMutation.mutate()} />

      <SidebarInset className="min-w-0 h-svh overflow-y-auto">
        <header className="sticky top-0 z-40 flex min-h-20 shrink-0 items-center gap-2 border-b bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1 md:hidden" />
          <Separator orientation="vertical" className="hidden h-4 md:block" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-foreground md:text-xl">
              {meta.title}
            </h1>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 w-full">
          <div className="mx-auto mt-4 w-full max-w-6xl px-4 pb-6 md:px-6">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
