import { IntegrationProxiesPage } from "@/features/integration/proxies/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/integration/proxies")({
  component: IntegrationProxiesPage,
});
