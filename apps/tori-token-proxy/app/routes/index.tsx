import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return <Navigate to="/dashboard" replace />;
}
