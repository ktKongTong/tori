import { Button } from "@repo/ui/components/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import {
  attachBotInstanceEndpoint,
  createBotInstance,
  type CreateBotInstanceInput,
} from "@/features/bot-instances/api";
import { useModal } from "@/lib/modal";

const noEndpointValue = "__none__";

const createBotInstanceFormSchema = z.object({
  autoCreateInternalEndpoint: z.boolean(),
  capabilities: z.string().refine(
    (value) => {
      if (!value.trim()) return true;

      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Capabilities must be valid JSON" },
  ),
  displayName: z.string(),
  instanceKey: z.string().trim().min(1, "Instance key is required"),
  namespace: z.string().trim().min(1, "Namespace is required"),
  platform: z.string().trim().min(1, "Platform is required"),
});

const createBotInstanceDefaultValues: z.input<typeof createBotInstanceFormSchema> = {
  platform: "",
  namespace: "managed",
  instanceKey: "",
  displayName: "",
  capabilities: '{"ingress":true,"sse":true}',
  autoCreateInternalEndpoint: true,
};

const attachEndpointFormSchema = z.object({
  deliveryEndpointId: z.string(),
});

export function CreateBotInstanceDialog() {
  const modal = useModal();
  const queryClient = useQueryClient();
  const createInstance = useMutation({
    mutationFn: async (input: CreateBotInstanceInput) => createBotInstance(input),
    onSuccess: (data) => {
      modal.close();
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "bot-instances"] });
      toast.success("Bot instance ready", {
        description: `Bot instance ${data.id} ready. Credential: ${data.plaintextCredential}`,
      });
    },
  });
  const createForm = useForm({
    defaultValues: createBotInstanceDefaultValues,
    validators: {
      onSubmit: createBotInstanceFormSchema,
    },
    onSubmit: ({ value }) => {
      const parsed = createBotInstanceFormSchema.parse(value);

      createInstance.mutate({
        ...parsed,
        capabilities: parsed.capabilities.trim() ? JSON.parse(parsed.capabilities) : undefined,
      });
    },
  });

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Create Bot Instance</DialogTitle>
        <DialogDescription>
          Create a managed bot runtime instance. Optionally auto-create the internal delivery
          endpoint.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void createForm.handleSubmit();
        }}
      >
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <createForm.Field
            name="platform"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Platform</FieldLabel>
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
          <createForm.Field
            name="namespace"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Namespace</FieldLabel>
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
          <createForm.Field
            name="instanceKey"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Instance Key</FieldLabel>
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
          <createForm.Field
            name="displayName"
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
          <createForm.Field
            name="capabilities"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field className="md:col-span-2" data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Capabilities JSON</FieldLabel>
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
          <createForm.Field
            name="autoCreateInternalEndpoint"
            children={(field) => (
              <Field className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.checked)}
                  />
                  Auto create internal delivery endpoint
                </label>
              </Field>
            )}
          />
          <div className="md:col-span-2 flex justify-end">
            <createForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={createInstance.isPending || isSubmitting || !canSubmit}
                >
                  {createInstance.isPending || isSubmitting ? "Creating…" : "Create Bot Instance"}
                </Button>
              )}
            />
          </div>
        </FieldGroup>
      </form>
    </DialogContent>
  );
}

export function AttachDeliveryEndpointDialog({
  defaultEndpointId,
  deliveryEndpoints,
  instanceId,
}: {
  defaultEndpointId?: string | null;
  deliveryEndpoints: Array<{
    displayName: string;
    id: string;
    kind: string;
    platform: string;
  }>;
  instanceId: string;
}) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const attachEndpoint = useMutation({
    mutationFn: async (input: z.output<typeof attachEndpointFormSchema>) =>
      attachBotInstanceEndpoint(instanceId, input),
    onSuccess: (data) => {
      modal.close();
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "bot-instances"] });
      toast.success("Delivery endpoint attached", {
        description: `Attached endpoint ${data.deliveryEndpointId ?? "none"} to ${data.id}.`,
      });
    },
  });
  const attachForm = useForm({
    defaultValues: {
      deliveryEndpointId: defaultEndpointId ?? "",
    },
    validators: {
      onSubmit: attachEndpointFormSchema,
    },
    onSubmit: ({ value }) => {
      attachEndpoint.mutate(attachEndpointFormSchema.parse(value));
    },
  });

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Attach Delivery Endpoint</DialogTitle>
        <DialogDescription>
          Attach or detach a delivery endpoint for the selected bot runtime instance.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void attachForm.handleSubmit();
        }}
      >
        <FieldGroup>
          <attachForm.Field
            name="deliveryEndpointId"
            children={(field) => (
              <Field>
                <FieldLabel>Delivery Endpoint</FieldLabel>
                <Select
                  value={field.state.value || noEndpointValue}
                  onValueChange={(value) =>
                    field.handleChange(!value || value === noEndpointValue ? "" : value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noEndpointValue}>No endpoint</SelectItem>
                    {deliveryEndpoints.map((endpoint) => (
                      <SelectItem key={endpoint.id} value={endpoint.id}>
                        {endpoint.platform} · {endpoint.kind} · {endpoint.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
          <div className="flex justify-end">
            <attachForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={attachEndpoint.isPending || isSubmitting || !canSubmit}
                >
                  {attachEndpoint.isPending || isSubmitting ? "Saving…" : "Attach Endpoint"}
                </Button>
              )}
            />
          </div>
        </FieldGroup>
      </form>
    </DialogContent>
  );
}
