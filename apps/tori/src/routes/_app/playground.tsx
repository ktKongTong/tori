import { DashboardBotPage } from "@/features/playground/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/playground")({
  component: DashboardBotPage,
});
