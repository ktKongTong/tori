import { BotInstancesPage } from "@/features/bot-instances/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/bot-instances")({
  component: BotInstancesPage,
});
