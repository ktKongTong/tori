import { NotifySubscriptionPage } from "@/features/notify/notify/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/notify/")({
  component: NotifySubscriptionPage,
});
