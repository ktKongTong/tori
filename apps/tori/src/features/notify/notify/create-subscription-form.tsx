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
import { Link } from "@tanstack/react-router";

import { createSubscription as createSubscriptionRequest } from "@/features/notify/api";
import { useChannelBindingsQuery } from "@/features/binding/query";
import { useConnectionsQuery } from "@/features/integration/query";
import { useModal } from "@/lib/modal";
import { useToastError } from "@/lib/toast-error";
import type { CreateSubscriptionDto } from "@/api/modules/platform/subscription/contract";

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
    mutationFn: async (input: CreateSubscriptionDto) => createSubscriptionRequest(input),
    onSuccess: async (data) => {
      modal.close();
      await queryClient.invalidateQueries({
        queryKey: ["notify", "subscriptions"],
      });
      toast.success("Subscription created", {
        description: `Subscription ${data.id} now watches ${data.topicType}.`,
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

  if (bindingQuery.isLoading || integrationQuery.isLoading) {
    return (
      <DialogContent>
        <p className="p-8 text-center text-muted-foreground">Checking dependencies...</p>
      </DialogContent>
    );
  }

  // Dependency Checks
  if (availableChannelBindings.length === 0) {
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Channel Required</DialogTitle>
          <DialogDescription>
            You need to bind at least one chat channel before you can create a subscription.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 text-center">
          <Button
            variant="default"
            render={<Link to="/binding/channels" />}
            onClick={() => modal.close()}
          >
            Go to Channel Bindings
          </Button>
        </div>
      </DialogContent>
    );
  }

  if (availableConnections.length === 0) {
    return (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connection Required</DialogTitle>
          <DialogDescription>
            You need to connect an external account (like Steam) before you can subscribe to its
            events.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 text-center">
          <Button
            variant="default"
            render={<Link to="/integration" />}
            onClick={() => modal.close()}
          >
            Go to Connections
          </Button>
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="normal-case">Create Subscription</DialogTitle>
        <DialogDescription>
          Choose what you want to subscribe to and where the notifications should be delivered.
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
          <Field>
            <FieldLabel>1. What to subscribe to?</FieldLabel>
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
                    <SelectValue placeholder="Choose a subscription target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={'steam.family|*|["family.library.updated"]'}>
                      Steam Family Library Changes
                    </SelectItem>
                    <SelectItem value={'steam.account|*|["profile.updated"]'}>
                      Steam Profile Updates
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <subscriptionForm.Field
            name="connectionId"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel>2. Use which account?</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value ?? "")}
                  >
                    <SelectTrigger className="w-full" aria-invalid={invalid}>
                      <SelectValue placeholder="Select a connected account" />
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

          <subscriptionForm.Field
            name="channelId"
            children={(field) => {
              const invalid = field.state.meta.errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel>3. Deliver to where?</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value ?? "")}
                  >
                    <SelectTrigger className="w-full" aria-invalid={invalid}>
                      <SelectValue placeholder="Select a bound channel" />
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

          <div className="md:col-span-2 flex justify-end mt-4">
            <subscriptionForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
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
