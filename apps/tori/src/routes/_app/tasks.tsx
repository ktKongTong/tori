import { TasksPage } from "@/features/tasks/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/tasks")({
  component: TasksPage,
});
