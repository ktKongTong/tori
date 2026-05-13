import { Button } from "@repo/ui/components/button";
import { DashboardNotice } from "@/components/dashboard-ui";
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

import { createBotInstance } from "@/features/bot-instances/api";
import { useModal } from "@/lib/modal";
import type { CreateBotInstanceDto } from "@/api/modules/platform/bot-plugin/contract";

const createBotInstanceFormSchema = z
  .object({
    endpointConfig: z.string().refine(
      (value) => {
        if (!value.trim()) return true;

        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: "Endpoint config must be valid JSON" },
    ),
    endpointKind: z.enum(["webhook", "internal"]),
    endpointSecret: z.string(),
    endpointTarget: z.string().trim().min(1, "Endpoint target is required"),
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
    name: z.string(),
    instanceKey: z.string().trim().min(1, "Instance key is required"),
    namespace: z.string().trim().min(1, "Namespace is required"),
    platform: z.string().trim().min(1, "Platform is required"),
  })
  .superRefine((value, ctx) => {
    if (value.endpointKind === "webhook" && !/^https?:\/\//.test(value.endpointTarget)) {
      ctx.addIssue({
        code: "custom",
        path: ["endpointTarget"],
        message: "Webhook target must be an http(s) URL",
      });
    }
    if (value.endpointKind === "internal" && !value.endpointTarget.startsWith("internal://")) {
      ctx.addIssue({
        code: "custom",
        path: ["endpointTarget"],
        message: "Internal target must start with internal://",
      });
    }
  });

const createBotInstanceDefaultValues: z.input<typeof createBotInstanceFormSchema> = {
  platform: "",
  namespace: "managed",
  instanceKey: "",
  name: "",
  capabilities: '{"ingress":true}',
  endpointKind: "webhook",
  endpointTarget: "",
  endpointSecret: "",
  endpointConfig: "{}",
};

export function CreateBotInstanceDialog() {
  const modal = useModal();
  const queryClient = useQueryClient();
  const createInstance = useMutation({
    mutationFn: async (input: CreateBotInstanceDto) => createBotInstance(input),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "bot-instances"] });
      modal.open(
        <BotCredentialDialog
          title={data.created ? "Bot Instance Credential" : "Bot Credential Rotated"}
          description={
            data.created
              ? "Store this credential now. Tori only shows it once."
              : "The existing runtime credential was replaced. Update the deployed plugin before closing."
          }
          instanceId={data.id}
          plaintextCredential={data.plaintextCredential}
        />,
      );
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
        platform: parsed.platform,
        namespace: parsed.namespace,
        instanceKey: parsed.instanceKey,
        name: parsed.name,
        capabilities: parsed.capabilities.trim() ? JSON.parse(parsed.capabilities) : undefined,
        deliveryEndpoint: {
          kind: parsed.endpointKind,
          target: parsed.endpointTarget,
          name: parsed.name ? `${parsed.name} delivery` : null,
          secret: parsed.endpointSecret.trim() || null,
          config: parsed.endpointConfig.trim() ? JSON.parse(parsed.endpointConfig) : undefined,
          metadata: { source: "bot-instance-create" },
        },
      });
    },
  });

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Create Bot Instance</DialogTitle>
        <DialogDescription>
          Create a managed bot runtime instance and its delivery endpoint in one step.
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
          <div className="md:col-span-2 border-t border-border pt-4">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Delivery Endpoint
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Webhook is the default for separated bot plugins. Internal is only for playground
              runtimes.
            </p>
          </div>
          <createForm.Field
            name="endpointKind"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel>Endpoint Kind</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value === "internal" ? "internal" : "webhook")
                    }
                  >
                    <SelectTrigger className="w-full" aria-invalid={invalid}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webhook">webhook</SelectItem>
                      <SelectItem value="internal">internal playground</SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <createForm.Field
            name="endpointTarget"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Endpoint Target</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={invalid}
                    placeholder="https://plugin.example.com/webhooks/tori/notifications"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <createForm.Field
            name="endpointSecret"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Endpoint Secret</FieldLabel>
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
            name="endpointConfig"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>Endpoint Config JSON</FieldLabel>
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

export function BotCredentialDialog({
  description,
  instanceId,
  plaintextCredential,
  title,
}: {
  description: string;
  instanceId: string;
  plaintextCredential: string;
  title: string;
}) {
  const copyCredential = async () => {
    await navigator.clipboard.writeText(plaintextCredential);
    toast.success("Credential copied");
  };

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle className="normal-case">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DashboardNotice title="One-time secret" tone="success">
        <p>
          This credential is only visible in this dialog. Closing it means you must rotate the
          credential to see a new value.
        </p>
      </DashboardNotice>
      <div className="space-y-3">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Instance
        </p>
        <code className="block overflow-x-auto border border-border bg-muted/30 px-3 py-2 text-sm">
          {instanceId}
        </code>
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Credential
        </p>
        <code className="block overflow-x-auto border border-border bg-muted/30 px-3 py-2 text-sm">
          {plaintextCredential}
        </code>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => void copyCredential()}>Copy Credential</Button>
      </div>
    </DialogContent>
  );
}
