import * as React from "react";

import { cn } from "@repo/ui/lib/utils";

function formatFieldError(error: unknown) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  if (typeof error === "object") return JSON.stringify(error);
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return String(error);
  }
  if (typeof error === "symbol") return error.description ?? "Invalid value";

  return "Invalid value";
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("@container/field-group flex flex-col gap-6", className)}
      {...props}
    />
  );
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field" className={cn("flex flex-col gap-2", className)} {...props} />;
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="field-content" className={cn("flex flex-col gap-1.5", className)} {...props} />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  errors,
  ...props
}: React.ComponentProps<"p"> & {
  errors?: unknown[];
}) {
  const message = formatFieldError(errors?.[0] ?? props.children);

  if (!message) return null;

  return (
    <p data-slot="field-error" className={cn("text-xs text-destructive", className)} {...props}>
      {message}
    </p>
  );
}

export { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel };
