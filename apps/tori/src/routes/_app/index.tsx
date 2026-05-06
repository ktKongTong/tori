import { DashboardOverviewPage } from "@/features/overview/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  component: DashboardOverviewPage,
});
