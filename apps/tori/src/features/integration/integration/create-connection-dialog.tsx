import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { FieldLabel as Label } from "@repo/ui/components/field";

import { useProxyInstancesQuery } from "@/features/integration/query";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useCreateConnection } from "@/features/integration/mutation.ts";

const createConnectionFormSchema = z.object({
  provider: z.string(),
  accountId: z.string(),
  accessMode: z.enum(["mixed", "proxy-token", "public-id"]),
  proxyInstanceId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullish(),
});

const availablePlatforms = ["steam", "beatsaver", "bangdream"];

type TokenProxyConnectionResult = {
  proxyInstanceId: string;
  provider: string;
  providerAccountId?: string;
  providerAccountName?: string | null;
  proxyConnectionId?: string;
  apiKey?: string | null;
};

async function connectViaTokenProxyInBrowser(input: {
  proxyBaseUrl: string;
  proxyInstanceId: string;
  provider: string;
}) {
  if (typeof window === "undefined") {
    throw new Error("token-proxy connect must run in the browser");
  }

  const state = crypto.randomUUID();
  const callbackUrl = new URL(
    "/api/integration/connections/token-proxy/callback",
    window.location.origin,
  );
  callbackUrl.searchParams.set("state", state);
  callbackUrl.searchParams.set("proxyInstanceId", input.proxyInstanceId);
  callbackUrl.searchParams.set("provider", input.provider);

  const connectUrl = new URL("/admin/connections/connect", input.proxyBaseUrl);
  connectUrl.searchParams.set("provider", input.provider);
  connectUrl.searchParams.set("state", state);
  connectUrl.searchParams.set("callback", callbackUrl.toString());

  const popup = window.open(
    connectUrl.toString(),
    "tori-token-proxy-connect",
    "popup,width=720,height=860",
  );
  if (!popup) {
    throw new Error("Unable to open token-proxy connect window");
  }

  return new Promise<TokenProxyConnectionResult>((resolve, reject) => {
    const channelName = `tori-token-proxy-connect:${state}`;
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

      if (message.type !== "tori:token-proxy-connect" || message.state !== state) return;

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
  const form = useForm({
    defaultValues: {
      provider: availablePlatforms[0],
      accountId: "",
      accessMode: "public-id",
      proxyInstanceId: null,
      metadata: null,
    } as z.infer<typeof createConnectionFormSchema>,
    validators: {
      onSubmit: createConnectionFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (value.proxyInstanceId) {
        const proxy = proxyData?.data?.find((item) => item.id === value.proxyInstanceId);
        if (!proxy) {
          toast.error("Selected token-proxy instance is not available");
          return;
        }

        await connectViaTokenProxyInBrowser({
          proxyBaseUrl: proxy.baseUrl,
          proxyInstanceId: value.proxyInstanceId,
          provider: value.provider,
        });
        toast.success("token-proxy connection completed");
        return;
      }

      createConnection.mutate({
        provider: value.provider,
        providerAccountId: value.accountId,
        accessMode: value.accessMode,
        proxyInstanceId: null,
        isDefault: false,
      });
      toast.success("Form submitted successfully");
    },
  });
  const {
    data: proxyData,
    isLoading: proxiesLoading,
    refetch: refetchProxies,
  } = useProxyInstancesQuery();

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add Connection</DialogTitle>
        <DialogDescription>
          Connect an external account to receive notifications and execute commands.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <form onSubmit={form.handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="space-y-4">
              <Label>Platform</Label>
              <div className="grid grid-cols-2 gap-2">
                {availablePlatforms.map((p) => (
                  <Button
                    key={p}
                    variant={form.getFieldValue("provider") === p ? "default" : "outline"}
                    onClick={() => form.setFieldValue("provider", p)}
                    className="capitalize"
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Label>Connection Method</Label>
              <Select
                value={form.getFieldValue("proxyInstanceId") ?? "direct"}
                onValueChange={(v) => {
                  const proxyInstanceId = v === "direct" ? null : v;
                  form.setFieldValue("proxyInstanceId", proxyInstanceId);
                  form.setFieldValue("accessMode", proxyInstanceId ? "proxy-token" : "public-id");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a proxy or direct" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct (Public ID only)</SelectItem>
                  {proxyData?.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      Proxy: {p.name ?? p.baseUrl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={createConnection.isPending}>
            {createConnection.isPending ? "Connecting..." : "Connect Account"}
          </Button>
        </form>
      </div>
    </DialogContent>
  );
}
