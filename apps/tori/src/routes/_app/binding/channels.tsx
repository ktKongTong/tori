import { BindingChannelsPage } from "@/features/binding/channels/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/binding/channels")({
  component: BindingChannelsPage,
});
