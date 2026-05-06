import { IntegrationPage } from "@/features/integration/integration/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/integration/")({
  component: IntegrationPage,
});
