import { Button } from "@repo/ui/components/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
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
  createSubscription as createSubscriptionRequest,
} from "@/features/notify/api";
import { useChannelBindingsQuery } from "@/features/binding/query";
import { useConnectionsQuery } from "@/features/integration/query";
import { useModal } from "@/lib/modal";
import { useToastError } from "@/lib/toast-error";
import type {CreateSubscriptionInput} from "@/api/modules/platform/notify";

const subscriptionFormSchema = z.object({
  channelId: z.string().trim().min(1, "Target chat is required"),
  connectionId: z.string().trim().min(1, "Connection is required"),
  eventTypes: z.string().refine(
    (value) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.every((item) => typeof item === "string");
      } catch {
        return false;
      }
    },
    { message: "Event types must be a JSON string array" },
  ),
  ownerId: z.string(),
  ownerType: z.string(),
  topicKey: z.string().trim().min(1, "Topic key is required"),
  topicType: z.string().trim().min(1, "Topic type is required"),
});

const subscriptionDefaultValues: z.input<typeof subscriptionFormSchema> = {
  channelId: "",
  connectionId: "",
  ownerType: "USER",
  ownerId: "",
  topicType: "steam.family",
  topicKey: "*",
  eventTypes: '["family.library.updated"]',
};

type SubscriptionDialogProps = {
  defaultValues?: Partial<z.input<typeof subscriptionFormSchema>>;
  userId: string;
};

export function SubscriptionDialog({ defaultValues, userId }: SubscriptionDialogProps) {
  const modal = useModal();
  const queryClient = useQueryClient();

  const bindingQuery = useChannelBindingsQuery();
  const integrationQuery = useConnectionsQuery();
  const availableChannelBindings = bindingQuery.data?.items ?? [];
  const availableConnections =
    integrationQuery.data?.items.filter((item) => item.connection.status === "active") ?? [];

  const createSubscription = useMutation({
    mutationFn: async (input: CreateSubscriptionInput) => createSubscriptionRequest(input),
    onSuccess: async (data) => {
      modal.close();
      await queryClient.invalidateQueries({
        queryKey: ["notify", "subscriptions"],
      });
      toast.success("Subscription created", {
        description: `Subscription ${data.id} now watches ${data.topicType}. Refresh task: ${data.refreshTaskId ?? "none"} (${data.refreshTaskCreated ? "created" : "reused"}).`,
      });
    },
  });
  const subscriptionForm = useForm({
    defaultValues: {
      ...subscriptionDefaultValues,
      ...defaultValues,
      ownerId: userId,
      ownerType: "USER",
    },
    validators: {
      onSubmit: subscriptionFormSchema,
    },
    onSubmit: ({ value }) => {
      const parsed = subscriptionFormSchema.parse(value);

      createSubscription.mutate({
        ...parsed,
        ownerId: userId,
        ownerType: "USER",
        eventTypes: JSON.parse(parsed.eventTypes),
      });
    },
  });

  useToastError(createSubscription.error, { title: "Failed to create subscription" });

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Create Subscription</DialogTitle>
        <DialogDescription>
          Pick the chat surface that should receive notifications and the connection that should
          drive refresh and matching.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void subscriptionForm.handleSubmit();
        }}
      >
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <subscriptionForm.Field
            name="channelId"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel>Target Chat</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value ?? "")}
                  >
                    <SelectTrigger className="w-full" aria-invalid={invalid}>
                      <SelectValue placeholder="Select a bound chat" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableChannelBindings.map((binding) => (
                        <SelectItem key={binding.binding.id} value={binding.binding.channelId}>
                          {binding.channel?.name ?? binding.binding.channelId} ·{" "}
                          {binding.binding.externalChannelName ?? binding.binding.externalChannelId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <subscriptionForm.Field
            name="connectionId"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel>Connection</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value ?? "")}
                  >
                    <SelectTrigger className="w-full" aria-invalid={invalid}>
                      <SelectValue placeholder="Select a connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConnections.map((connection) => (
                        <SelectItem key={connection.connection.id} value={connection.connection.id}>
                          {connection.connection.providerAccountName ??
                            connection.connection.providerAccountId}{" "}
                          · {connection.connection.provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          />
          <Field>
            <FieldLabel>Subscription Template</FieldLabel>
            <subscriptionForm.Subscribe
              selector={(state) => ({
                eventTypes: state.values.eventTypes,
                topicKey: state.values.topicKey,
                topicType: state.values.topicType,
              })}
              children={(template) => (
                <Select
                  value={`${template.topicType}|${template.topicKey}|${template.eventTypes}`}
                  onValueChange={(value) => {
                    if (!value) return;
                    const [topicType, topicKey, eventTypes] = value.split("|");
                    subscriptionForm.setFieldValue("topicType", topicType);
                    subscriptionForm.setFieldValue("topicKey", topicKey);
                    subscriptionForm.setFieldValue("eventTypes", eventTypes);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={'steam.family|*|["family.library.updated"]'}>
                      Steam family library changes
                    </SelectItem>
                    <SelectItem value={'steam.account|*|["profile.updated"]'}>
                      Steam profile updates
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <subscriptionForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={createSubscription.isPending || isSubmitting || !canSubmit}
                >
                  {createSubscription.isPending || isSubmitting
                    ? "Creating…"
                    : "Create Subscription"}
                </Button>
              )}
            />
          </div>
        </FieldGroup>
      </form>
    </DialogContent>
  );
}
