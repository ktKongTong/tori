import { BindingPage } from "@/features/binding/binding/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/binding/")({
  component: BindingPage,
});
