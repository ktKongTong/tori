import { SignUpPage } from "@/features/auth/components/sign-up-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/auth/sign-up")({
  component: SignUpPage,
});
