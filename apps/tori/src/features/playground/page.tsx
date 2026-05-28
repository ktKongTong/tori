import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { uniqueId } from "@repo/utils/id";
import { useForm } from "@tanstack/react-form";
import { useLocation } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NotificationBody } from "@/api/modules/platform/notification/notification/body.ts";
import { z } from "zod";

import { DashboardNotice } from "@/components/dashboard-ui";
import { useSession } from "@/lib/auth-client";
import { renderBotResult } from "@/lib/bot-command-renderer";
import {
  DEFAULT_PLAYGROUND_PLATFORM,
  createPlaygroundChannelExternalId,
  createPlaygroundUserExternalId,
} from "@/shared/platform/playground";
import { sendBotIngressRequest } from "./api";

type NotificationStreamEnvelope =
  | {
      type: "connected";
      timestamp: string;
    }
  | {
      type: "heartbeat";
      timestamp: string;
    }
  | {
      type: "notification";
      notification: {
        id: string;
        body: NotificationBody;
        title?: string | null;
        createdAt: string;
      };
    };

type TranscriptTextEntry = {
  id: string;
  role: "user" | "assistant" | "system";
  timestamp: string;
  kind: "text";
  text: string;
};

type TranscriptNotificationEntry = {
  id: string;
  role: "system";
  timestamp: string;
  kind: "notification";
  notification: {
    title?: string | null;
    body: NotificationBody;
  };
};

type TranscriptEntry = TranscriptTextEntry | TranscriptNotificationEntry;

const DASHBOARD_SYNC_CHANNEL = "dashboard-sync";
const PLAYGROUND_SURFACE_STORAGE_PREFIX = "steam-bot.playground-surface";

const QUICK_COMMANDS = [
  "/help",
  "/status",
  "/connect steam id 76561198000000000",
  "/steam account profile",
  "/steam account inventory",
  "/sub steam family",
  "/unsub steam family",
];

const botMessageFormSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
});

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const bubbleClass =
    entry.role === "user"
      ? "ml-auto max-w-[82%] border border-primary/20 bg-primary/10 text-foreground"
      : entry.role === "assistant"
        ? "mr-auto max-w-[82%]  border border-border bg-card text-foreground"
        : "mx-auto max-w-[90%] border border-border bg-muted/30 text-foreground";

  return (
    <div
      className={`px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${bubbleClass}`}
    >
      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
        {entry.role} · {new Date(entry.timestamp).toLocaleTimeString()}
      </p>
      {entry.kind === "notification" ? (
        <NotificationBodyView
          body={entry.notification.body}
          title={entry.notification.title ?? null}
          className="mt-2"
        />
      ) : (
        <p className="mt-2 whitespace-pre-wrap leading-6">{entry.text}</p>
      )}
    </div>
  );
}

function NotificationBodyView({
  title,
  body,
  className,
}: {
  title?: string | null;
  body: NotificationBody;
  className?: string;
}) {
  return (
    <div className={className}>
      {title ? <p className="font-medium">{title}</p> : null}
      <pre className="mt-2 max-h-80 overflow-auto border border-border/70 bg-background/60 p-3 text-xs leading-5">
        {JSON.stringify(body, null, 2)}
      </pre>
    </div>
  );
}

function emitBindingUpdated() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(DASHBOARD_SYNC_CHANNEL);
  channel.postMessage({ type: "binding-updated" });
  channel.close();
}

function createDefaultMockSurface(baseName: string, userId?: string | null) {
  return {
    platform: DEFAULT_PLAYGROUND_PLATFORM,
    observedUserId: userId
      ? createPlaygroundUserExternalId(userId)
      : `playground-user-${uniqueId().slice(0, 8)}`,
    observedChannelId: userId
      ? createPlaygroundChannelExternalId(userId)
      : `playground-channel-${uniqueId().slice(0, 8)}`,
    observedUserName: `${baseName} Trial User`,
    observedChannelName: `${baseName} Trial Channel`,
    mockClientId: uniqueId(),
  };
}

function parseCommandInput(input: string) {
  const normalized = input.trim();
  const withoutSlash = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  const parts = withoutSlash.split(/\s+/).filter(Boolean);
  return {
    commandName: parts[0] ?? "",
    commandParams: parts.slice(1),
  };
}

export function DashboardBotPage() {
  const { data: session } = useSession();
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.searchStr), [location.searchStr]);
  const prefill = useMemo(
    () => ({
      platform: searchParams.get("platform"),
      observedUserId: searchParams.get("observedUserId"),
      observedChannelId: searchParams.get("observedChannelId"),
      message: searchParams.get("message"),
      bindingToken: searchParams.get("bindingToken"),
    }),
    [searchParams],
  );
  const hasUrlPrefill = Boolean(
    prefill.platform ||
    prefill.observedUserId ||
    prefill.observedChannelId ||
    prefill.message ||
    prefill.bindingToken,
  );
  const storageKey = session?.user?.id
    ? `${PLAYGROUND_SURFACE_STORAGE_PREFIX}.${session.user.id}`
    : null;
  const mockBaseName = session?.user?.name?.trim() || "Playground";
  const mockUserId = session?.user?.id ?? null;
  const [platform, setPlatform] = useState("playground");
  const [observedUserId, setObservedUserId] = useState("");
  const [observedChannelId, setObservedChannelId] = useState("");
  const [observedUserName, setObservedUserName] = useState("");
  const [observedChannelName, setObservedChannelName] = useState("");
  const [bindingToken, setBindingToken] = useState("");
  const [_streamStatus, setStreamStatus] = useState("connecting");
  const [streamGeneration, setStreamGeneration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [_error, setError] = useState<string | null>(null);
  const [mockClientId, setMockClientId] = useState("");

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const didHydrateSurfaceRef = useRef(false);

  useEffect(() => {
    if (!storageKey || didHydrateSurfaceRef.current) return;

    const fallback = createDefaultMockSurface(mockBaseName, mockUserId);

    if (typeof window === "undefined") {
      setPlatform(fallback.platform);
      setObservedUserId(fallback.observedUserId);
      setObservedChannelId(fallback.observedChannelId);
      setObservedUserName(fallback.observedUserName);
      setObservedChannelName(fallback.observedChannelName);
      setMockClientId(fallback.mockClientId);
      didHydrateSurfaceRef.current = true;
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ReturnType<typeof createDefaultMockSurface>>;
        setPlatform(parsed.platform || fallback.platform);
        setObservedUserId(parsed.observedUserId || fallback.observedUserId);
        setObservedChannelId(parsed.observedChannelId || fallback.observedChannelId);
        setObservedUserName(parsed.observedUserName || fallback.observedUserName);
        setObservedChannelName(parsed.observedChannelName || fallback.observedChannelName);
        setMockClientId(parsed.mockClientId || fallback.mockClientId);
      } else {
        setPlatform(fallback.platform);
        setObservedUserId(fallback.observedUserId);
        setObservedChannelId(fallback.observedChannelId);
        setObservedUserName(fallback.observedUserName);
        setObservedChannelName(fallback.observedChannelName);
        setMockClientId(fallback.mockClientId);
      }
    } catch {
      setPlatform(fallback.platform);
      setObservedUserId(fallback.observedUserId);
      setObservedChannelId(fallback.observedChannelId);
      setObservedUserName(fallback.observedUserName);
      setObservedChannelName(fallback.observedChannelName);
      setMockClientId(fallback.mockClientId);
    }

    didHydrateSurfaceRef.current = true;
  }, [mockBaseName, mockUserId, storageKey]);

  useEffect(() => {
    if (
      !storageKey ||
      !observedUserId ||
      !observedChannelId ||
      !observedUserName ||
      !observedChannelName ||
      !mockClientId
    ) {
      return;
    }
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        platform,
        observedUserId,
        observedChannelId,
        observedUserName,
        observedChannelName,
        mockClientId,
      }),
    );
  }, [
    storageKey,
    platform,
    observedUserId,
    observedChannelId,
    observedUserName,
    observedChannelName,
    mockClientId,
  ]);

  useEffect(() => {
    if (!hasUrlPrefill) return;

    if (prefill.platform) setPlatform(prefill.platform);
    if (prefill.observedUserId) setObservedUserId(prefill.observedUserId);
    if (prefill.observedChannelId) setObservedChannelId(prefill.observedChannelId);
    if (prefill.bindingToken) setBindingToken(prefill.bindingToken);
  }, [hasUrlPrefill, prefill]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript.length]);

  useEffect(() => {
    const eventSource = new EventSource("/api/bot-ingress/stream");

    setStreamStatus("connecting");

    const handleConnected = (event: MessageEvent<string>) => {
      setStreamStatus("connected");
      const payload = JSON.parse(event.data) as NotificationStreamEnvelope;
      if (payload.type === "connected") {
        setTranscript((current) =>
          current.length
            ? current
            : [
                {
                  id: uniqueId(),
                  role: "system",
                  kind: "text",
                  text: "Playground notification stream connected.",
                  timestamp: payload.timestamp,
                },
              ],
        );
      }
    };

    const handleNotification = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as NotificationStreamEnvelope;
      if (payload.type !== "notification") return;

      setTranscript((current) => [
        ...current,
        {
          id: payload.notification.id,
          role: "system",
          kind: "notification",
          notification: {
            title: payload.notification.title ?? null,
            body: payload.notification.body,
          },
          timestamp: payload.notification.createdAt,
        },
      ]);
    };

    eventSource.addEventListener("connected", handleConnected as EventListener);
    eventSource.addEventListener("notification", handleNotification as EventListener);
    eventSource.onerror = () => setStreamStatus("reconnecting");

    return () => {
      eventSource.close();
      setStreamStatus("disconnected");
    };
  }, [streamGeneration]);

  const commandMutation = useMutation({
    mutationFn: async (payload: { message: string; rawPayload?: Record<string, unknown> }) => {
      const parsed = parseCommandInput(payload.message);
      return sendBotIngressRequest({
        commandName: parsed.commandName,
        commandParams:
          parsed.commandName === "bind" && bindingToken.trim() && parsed.commandParams.length === 0
            ? [bindingToken.trim()]
            : parsed.commandParams,
        messageContext: {
          platform,
          observedUserId,
          observedUserName,
          observedChannelId,
          observedChannelName,
          channelName: observedChannelName,
          channelType: "dm",
          rawPayload: {
            ...payload.rawPayload,
            mockClientId,
          },
        },
      });
    },
    onMutate: (variables) => {
      setTranscript((current) => [
        ...current,
        {
          id: uniqueId(),
          role: "user",
          kind: "text",
          text: variables.message,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    onSuccess: (response) => {
      const shouldRefreshBinding =
        response.action === "binding-applied" || response.action === "claim-issued";

      if (shouldRefreshBinding) {
        emitBindingUpdated();
      }

      setTranscript((current) => [
        ...current,
        {
          id: uniqueId(),
          role: "assistant",
          kind: "text",
          text: renderBotResult(response),
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Mock bot request failed";
      setError(message);
      setTranscript((current) => [
        ...current,
        {
          id: uniqueId(),
          role: "system",
          kind: "text",
          text: message,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
  });

  const botMessageForm = useForm({
    defaultValues: {
      message: "",
    },
    validators: {
      onSubmit: botMessageFormSchema,
    },
    onSubmit: ({ value }) => {
      const sentMessage = botMessageFormSchema.parse(value).message;

      setError(null);

      commandMutation.mutate({
        message: sentMessage,
        rawPayload: {
          surface: "playground-bot-client",
          mockClientId,
        },
      });
      botMessageForm.reset();
    },
  });

  useEffect(() => {
    if (!hasUrlPrefill || !prefill.message) return;
    botMessageForm.setFieldValue("message", prefill.message);
  }, [botMessageForm, hasUrlPrefill, prefill.message]);

  const handleMessageKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const handleResetMockSurface = () => {
    const next = createDefaultMockSurface(mockBaseName, mockUserId);
    setPlatform(next.platform);
    setObservedUserId(next.observedUserId);
    setObservedChannelId(next.observedChannelId);
    setObservedUserName(next.observedUserName);
    setObservedChannelName(next.observedChannelName);
    setMockClientId(next.mockClientId);
    setBindingToken("");
    setTranscript([]);
    setError(null);
    botMessageForm.reset();
    setStreamGeneration((value) => value + 1);
  };

  return (
    <section className="flex min-h-0 h-full flex-1 flex-col overflow-hidden ">
      <div className=" px-5 py-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-2 ml-auto">
            <Button onClick={handleResetMockSurface} variant="outline" size="xs">
              Reset
            </Button>
            <Button
              onClick={() => setStreamGeneration((value) => value + 1)}
              variant="outline"
              size="xs"
            >
              Refresh Stream
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 h-full overflow-y-auto no-scrollbar px-5 py-5">
        <div className="space-y-4">
          {transcript.length ? (
            transcript.map((entry) => <TranscriptBubble key={entry.id} entry={entry} />)
          ) : (
            <div className="flex h-[46vh] items-center justify-center border border-dashed px-8 text-center text-sm leading-7 text-muted-foreground">
              Start with `/status` or `/help`, then move on to binding an account, connecting a
              Steam identity, and testing subscriptions from the same trial surface.
            </div>
          )}
          {commandMutation.isPending ? (
            <DashboardNotice title="Assistant">Processing command...</DashboardNotice>
          ) : null}
          <div ref={chatEndRef} />
        </div>
      </div>

      <form
        className="shrink-0 border-t bg-background px-5 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void botMessageForm.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-auto no-scrollbar">
            {QUICK_COMMANDS.map((command) => (
              <Button
                key={command}
                type="button"
                onClick={() => botMessageForm.setFieldValue("message", command)}
                variant="outline"
                size="xs"
              >
                {command}
              </Button>
            ))}
          </div>
          <div className="border relative">
            <botMessageForm.Field
              name="message"
              children={(field) => (
                <Input
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  placeholder="ask bot with command..."
                  className="min-h-14 border-0 bg-transparent px-4 text-base shadow-none outline-none focus-visible:ring-0"
                />
              )}
            />
            <botMessageForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="absolute right-2 bottom-2 ml-auto"
                  disabled={commandMutation.isPending || isSubmitting || !canSubmit}
                >
                  {commandMutation.isPending || isSubmitting ? "Sending..." : "Send"}
                </Button>
              )}
            />
          </div>
        </div>
      </form>
    </section>
  );
}
