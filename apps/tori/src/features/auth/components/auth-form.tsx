import { Button } from "@repo/ui/components/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";

interface AuthFormProps {
  mode: "login" | "register";
  onSubmit: (email: string, password: string, name?: string) => Promise<void>;
  error?: string | null;
  loading?: boolean;
}

export function AuthForm({ mode, onSubmit, error, loading }: AuthFormProps) {
  const authFormSchema = z.object({
    email: z.email("Enter a valid email address"),
    name: z.string().superRefine((value, context) => {
      if (mode === "register" && !value.trim()) {
        context.addIssue({
          code: "custom",
          message: "Name is required",
        });
      }
    }),
    password: z.string().min(8, "Password must be at least 8 characters"),
  });

  const form = useForm({
    defaultValues: {
      email: "",
      name: "",
      password: "",
    },
    validators: {
      onSubmit: authFormSchema,
    },
    onSubmit: async ({ value }) => {
      const parsed = authFormSchema.parse(value);
      await onSubmit(parsed.email, parsed.password, mode === "register" ? parsed.name : undefined);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        {mode === "register" && (
          <form.Field
            name="name"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="text"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Your name"
                    aria-invalid={invalid}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
        )}

        <form.Field
          name="email"
          children={(field) => {
            const invalid = field.state.meta.errors.length > 0;

            return (
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={invalid}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            );
          }}
        />

        <form.Field
          name="password"
          children={(field) => {
            const invalid = field.state.meta.errors.length > 0;

            return (
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  aria-invalid={invalid}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            );
          }}
        />

        {error && (
          <Field data-invalid>
            <FieldError>{error}</FieldError>
          </Field>
        )}

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className="w-full"
              disabled={loading || isSubmitting || !canSubmit}
            >
              {loading || isSubmitting
                ? "Loading..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          )}
        />
      </FieldGroup>
    </form>
  );
}
