import { Button } from "@repo/ui/components/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { registerProxyInstance } from "@/features/integration/api";
import { useModal } from "@/lib/modal";

const proxyFormSchema = z.object({
  baseUrl: z.url("Enter a valid base URL"),
  credentialRef: z.string().trim().min(1, "Credential is required"),
  name: z.string(),
});

export function TokenProxyDialog() {
  const modal = useModal();
  const queryClient = useQueryClient();
  const registerProxy = useMutation({
    mutationFn: async (input: z.output<typeof proxyFormSchema>) => registerProxyInstance(input),
    onSuccess: async (data) => {
      modal.close();
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "integration"] });
      toast.success("Token proxy registered", {
        description: `${data.name ?? data.baseUrl}\nHealth: ${data.healthStatus}\nProviders: ${data.providers.map((provider) => provider.name).join(", ") || "none"}`,
      });
    },
  });
  const proxyForm = useForm({
    defaultValues: {
      name: "",
      baseUrl: "",
      credentialRef: "",
    },
    validators: {
      onSubmit: proxyFormSchema,
    },
    onSubmit: ({ value }) => {
      registerProxy.mutate(proxyFormSchema.parse(value));
    },
  });

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Add Token Proxy</DialogTitle>
        <DialogDescription>
          Register a token-proxy node and probe its supported providers and capabilities.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void proxyForm.handleSubmit();
        }}
      >
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <proxyForm.Field
            name="name"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Display Name</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={invalid}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <proxyForm.Field
            name="baseUrl"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Base URL</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={invalid}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <proxyForm.Field
            name="credentialRef"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Admin/API Credential</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={invalid}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <div className="md:col-span-2 flex justify-end">
            <proxyForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={registerProxy.isPending || isSubmitting || !canSubmit}
                >
                  {registerProxy.isPending || isSubmitting ? "Registering…" : "Add Token Proxy"}
                </Button>
              )}
            />
          </div>
        </FieldGroup>
      </form>
    </DialogContent>
  );
}

export function InspectTokenProxyDialog({
  proxy,
}: {
  proxy: {
    baseUrl: string;
    healthStatus: string;
    name: string;
    providers: Array<{ flow: string; name: string }>;
  };
}) {
  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Inspect Token Proxy</DialogTitle>
        <DialogDescription>
          Read the selected proxy inventory and currently probed providers.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Display Name</FieldLabel>
          <Input value={proxy.name} readOnly />
        </Field>
        <Field>
          <FieldLabel>Base URL</FieldLabel>
          <Input value={proxy.baseUrl} readOnly />
        </Field>
        <Field>
          <FieldLabel>Health</FieldLabel>
          <Input value={proxy.healthStatus} readOnly />
        </Field>
        <Field>
          <FieldLabel>Supported Providers</FieldLabel>
          <Input
            value={
              proxy.providers.map((provider) => `${provider.name} (${provider.flow})`).join(", ") ||
              "—"
            }
            readOnly
          />
        </Field>
      </FieldGroup>
    </DialogContent>
  );
}
