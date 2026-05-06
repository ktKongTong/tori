import { BindingClaimsPage } from "@/features/binding/claims/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/binding/claims")({
  component: BindingClaimsPage,
});
