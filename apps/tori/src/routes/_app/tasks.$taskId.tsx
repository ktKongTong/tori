import { TaskDetailPage } from "@/features/tasks/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/tasks/$taskId")({
  component: TaskDetailRoute,
});

function TaskDetailRoute() {
  const { taskId } = Route.useParams();
  return <TaskDetailPage taskId={taskId} />;
}
