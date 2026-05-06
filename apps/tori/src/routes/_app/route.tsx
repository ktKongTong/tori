import { createFileRoute, Outlet } from "@tanstack/react-router";
import DashboardLayout from "@/components/layout/dashboard-layout";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    // if (!context.auth.user) {
    //   throw redirect({
    //     to: '/login',
    //     search: {
    //       redirect: location.href,
    //     },
    //   })
    // }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
