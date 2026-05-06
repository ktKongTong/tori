import { NotifyEventsPage } from "@/features/notify/events/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/notify/events")({
  component: NotifyEventsPage,
});
