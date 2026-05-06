import { SignInPage } from "@/features/auth/components/sign-in-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/auth/sign-in")({
  component: SignInPage,
});
