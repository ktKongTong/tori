import { NotifyEndpointsPage } from "@/features/notify/endpoints/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/notify/endpoints")({
  component: NotifyEndpointsPage,
});
