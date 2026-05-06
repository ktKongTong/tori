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
import { Textarea } from "@repo/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { createDeliveryEndpoint, type CreateDeliveryEndpointInput } from "@/features/notify/api";
import { useModal } from "@/lib/modal";

const endpointFormSchema = z.object({
  config: z.string().refine(
    (value) => {
      if (!value.trim()) return true;

      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Config must be valid JSON" },
  ),
  displayName: z.string().trim().min(1, "Display name is required"),
  kind: z.string().trim().min(1, "Kind is required"),
  platform: z.string().trim().min(1, "Platform is required"),
  secret: z.string(),
  target: z.string().trim().min(1, "Target is required"),
});

const endpointDefaultValues: z.input<typeof endpointFormSchema> = {
  platform: "mock",
  kind: "webhook",
  target: "",
  displayName: "",
  secret: "",
  config: "{}",
};

type DeliveryEndpointDialogProps = {
  defaultValues?: Partial<z.input<typeof endpointFormSchema>>;
};

export function DeliveryEndpointDialog({ defaultValues }: DeliveryEndpointDialogProps) {
  const modal = useModal();
  const queryClient = useQueryClient();
  const createEndpoint = useMutation({
    mutationFn: async (input: CreateDeliveryEndpointInput) => createDeliveryEndpoint(input),
    onSuccess: async (data) => {
      modal.close();
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "notify", "delivery-endpoints"],
      });
      toast.success("Delivery endpoint registered", {
        description: `${data.platform} ${data.kind} endpoint now targets ${data.target}.`,
      });
    },
  });
  const endpointForm = useForm({
    defaultValues: {
      ...endpointDefaultValues,
      ...defaultValues,
    },
    validators: {
      onSubmit: endpointFormSchema,
    },
    onSubmit: ({ value }) => {
      const parsed = endpointFormSchema.parse(value);

      createEndpoint.mutate({
        ...parsed,
        config: parsed.config.trim() ? JSON.parse(parsed.config) : undefined,
      });
    },
  });

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Register Delivery Endpoint</DialogTitle>
        <DialogDescription>
          Register a delivery endpoint for bot-plugin notifications.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void endpointForm.handleSubmit();
        }}
      >
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <endpointForm.Field
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
          <endpointForm.Field
            name="kind"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel>Kind</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value ?? "")}
                  >
                    <SelectTrigger className="w-full" aria-invalid={invalid}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webhook">webhook</SelectItem>
                      <SelectItem value="internal">internal</SelectItem>
                      <SelectItem value="email">email</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <endpointForm.Field
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
          <endpointForm.Field
            name="target"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Target</FieldLabel>
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
          <endpointForm.Field
            name="secret"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Secret</FieldLabel>
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
          <endpointForm.Field
            name="config"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field className="md:col-span-2" data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Config JSON</FieldLabel>
                  <Textarea
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
            <endpointForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={createEndpoint.isPending || isSubmitting || !canSubmit}
                >
                  {createEndpoint.isPending || isSubmitting ? "Registering…" : "Register Endpoint"}
                </Button>
              )}
            />
          </div>
        </FieldGroup>
      </form>
    </DialogContent>
  );
}
