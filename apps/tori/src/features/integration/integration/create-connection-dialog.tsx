import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";

import { useProxyInstancesQuery } from "@/features/integration/query";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useCreateConnection } from "@/features/integration/mutation.ts";
import { startTokenProxyConnection } from "@/features/integration/api.ts";
import { useModal } from "@/lib/modal.tsx";

const createConnectionFormSchema = z
  .object({
    proxySelection: z.string().min(1, "Choose a token proxy or direct connection"),
    provider: z.string().min(1),
    accountId: z.string(),
    accessMode: z.literal("public-id"),
    metadata: z.record(z.string(), z.unknown()).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.proxySelection === "direct" && !value.accountId.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["accountId"],
        message: "Account ID is required for direct connections",
      });
    }
  });

const availablePlatforms = ["steam", "beatsaver", "bangdream"];

function formatProxyInstanceLabel(proxy: {
  name: string | null;
  baseUrl: string;
  provider: string;
  providers: { name: string }[];
}) {
  const providerLabel =
    proxy.providers.map((provider) => provider.name).join(", ") || proxy.provider;
  return {
    title: proxy.name ?? proxy.baseUrl,
    detail: `${proxy.baseUrl} / ${providerLabel}`,
  };
}

type TokenProxyConnectionResult = {
  proxyInstanceId: string;
  provider: string;
  providerAccountId?: string;
  providerAccountName?: string | null;
  proxyConnectionId?: string;
  apiKey?: string | null;
};

async function connectViaTokenProxyInBrowser(input: { proxyInstanceId: string; provider: string }) {
  if (typeof window === "undefined") {
    throw new Error("token-proxy connect must run in the browser");
  }

  const session = await startTokenProxyConnection(input.proxyInstanceId, {
    provider: input.provider,
    accessMode: "proxy-token",
  });

  const popup = window.open(
    session.connectUrl,
    "tori-token-proxy-connect",
    "popup,width=720,height=860",
  );
  if (!popup) {
    throw new Error("Unable to open token-proxy connect window");
  }

  return new Promise<TokenProxyConnectionResult>((resolve, reject) => {
    const channelName = `tori-token-proxy-connect:${session.state}`;
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName) : null;
    const timeout = window.setTimeout(
      () => {
        cleanup();
        reject(new Error("token-proxy connect timed out"));
      },
      5 * 60 * 1000,
    );
    const closedCheck = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("token-proxy connect window was closed"));
      }
    }, 1000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      window.clearInterval(closedCheck);
      window.removeEventListener("message", handleMessage);
      channel?.close();
    };

    const handlePayload = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;

      const message = payload as {
        type?: string;
        state?: string;
        status?: string;
        error?: string;
        connection?: TokenProxyConnectionResult;
      };

      if (message.type !== "tori:token-proxy-connect" || message.state !== session.state) return;

      cleanup();
      if (message.status === "completed" && message.connection) {
        resolve(message.connection);
        return;
      }

      reject(new Error(message.error ?? "token-proxy connect failed"));
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      handlePayload(event.data);
    };

    window.addEventListener("message", handleMessage);
    if (channel) {
      channel.onmessage = (event) => handlePayload(event.data);
    }
    popup.focus();
  });
}

export function AddConnectionDialog() {
  const createConnection = useCreateConnection();
  const queryClient = useQueryClient();
  const modal = useModal();
  const [isTokenProxyConnecting, setIsTokenProxyConnecting] = useState(false);
  const form = useForm({
    defaultValues: {
      proxySelection: "",
      provider: availablePlatforms[0],
      accountId: "",
      accessMode: "public-id",
      metadata: null,
    } as z.infer<typeof createConnectionFormSchema>,
    validators: {
      onSubmit: createConnectionFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (value.proxySelection !== "direct") {
        const proxy = activeProxyInstances.find((item) => item.id === value.proxySelection);
        if (!proxy) {
          toast.error("Selected token-proxy instance is not available");
          return;
        }

        const provider =
          proxy.providers[0]?.name ??
          (proxy.provider && proxy.provider !== "multi" ? proxy.provider : value.provider);

        setIsTokenProxyConnecting(true);
        try {
          await connectViaTokenProxyInBrowser({
            proxyInstanceId: proxy.id,
            provider,
          });
          void queryClient.invalidateQueries({ queryKey: ["integration", "connections"] });
          toast.success("token-proxy connection completed");
          modal.close();
        } finally {
          setIsTokenProxyConnecting(false);
        }
        return;
      }

      await createConnection.mutateAsync({
        provider: value.provider,
        providerAccountId: value.accountId.trim(),
        accessMode: value.accessMode,
        proxyInstanceId: null,
        isDefault: false,
      });
      modal.close();
    },
  });
  const { data: proxyData } = useProxyInstancesQuery();
  const proxyInstances = proxyData?.data ?? [];
  const activeProxyInstances = proxyInstances.filter((proxy) => proxy.status === "active");
  const proxySelectItems = [
    ...activeProxyInstances.map((proxy) => {
      const label = formatProxyInstanceLabel(proxy);
      return {
        label: `${label.title} / ${label.detail}`,
        value: proxy.id,
      };
    }),
    { label: "Continue without token proxy", value: "direct" },
  ];

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add Connection</DialogTitle>
        <DialogDescription>
          Connect an external account to receive notifications and execute commands.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup className="space-y-4">
            <form.Field
              name="proxySelection"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel>Token Proxy</FieldLabel>
                  <Select
                    items={proxySelectItems}
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (!value) return;
                      field.handleChange(value);
                      if (value !== "direct") {
                        form.setFieldValue("accountId", "");
                      }
                    }}
                    disabled={isTokenProxyConnecting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a token proxy or direct connection" />
                    </SelectTrigger>
                    <SelectContent>
                      {proxySelectItems.map((proxy) => (
                        <SelectItem key={proxy.value} value={proxy.value}>
                          {proxy.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            />
            <form.Subscribe
              selector={(state) => state.values.proxySelection}
              children={(proxySelection) =>
                proxySelection === "direct" ? (
                  <>
                    <form.Field
                      name="provider"
                      children={(field) => (
                        <Field>
                          <FieldLabel>Platform</FieldLabel>
                          <div className="grid grid-cols-2 gap-2">
                            {availablePlatforms.map((platform) => (
                              <Button
                                key={platform}
                                type="button"
                                variant={field.state.value === platform ? "default" : "outline"}
                                onClick={() => field.handleChange(platform)}
                                className="capitalize"
                              >
                                {platform}
                              </Button>
                            ))}
                          </div>
                        </Field>
                      )}
                    />
                    <form.Field
                      name="accountId"
                      children={(field) => {
                        const invalid = field.state.meta.errors.length > 0;

                        return (
                          <Field data-invalid={invalid}>
                            <FieldLabel htmlFor={field.name}>Account ID</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.target.value)}
                              aria-invalid={invalid}
                              placeholder="External account ID"
                            />
                            <FieldError errors={field.state.meta.errors} />
                          </Field>
                        );
                      }}
                    />
                  </>
                ) : null
              }
            />
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    createConnection.isPending ||
                    isTokenProxyConnecting ||
                    isSubmitting ||
                    !canSubmit
                  }
                >
                  {createConnection.isPending || isTokenProxyConnecting || isSubmitting
                    ? "Connecting..."
                    : "Connect Account"}
                </Button>
              )}
            />
          </FieldGroup>
        </form>
      </div>
    </DialogContent>
  );
}
