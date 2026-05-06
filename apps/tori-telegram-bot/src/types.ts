export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type Logger = Pick<typeof console, "error" | "info" | "warn">;

export type ToriCommandRequest = {
  commandName: string;
  commandParams: string[];
  messageContext: {
    platform: string;
    observedUserId: string;
    observedUserName: string;
    observedChannelId: string;
    observedChannelName: string;
    namespace?: string | null;
    channelType: string;
    channelName: string;
    rawPayload?: Record<string, unknown>;
  };
};

export type ToriBotCommandResponse = {
  action: string;
  context: {
    userId: string | null;
    channelId: string;
    anonymousUserId: string | null;
    userBindingId: string | null;
    channelBindingId: string;
    namespace: string;
  };
  state: unknown;
};

export type NotificationBodyBlock =
  | {
      type: "heading";
      text: string;
    }
  | {
      type: "text";
      text: string;
    }
  | {
      type: "stats";
      items: Array<{ label: string; value: string }>;
    }
  | {
      type: "list";
      style?: "unordered" | "ordered";
      items: string[];
    }
  | {
      type: "game-grid";
      title?: string | null;
      items: Array<{
        appId: string;
        title: string;
        imageUrl?: string | null;
        subtitle?: string | null;
      }>;
    }
  | {
      type: "image";
      url: string;
      alt?: string | null;
      caption?: string | null;
    }
  | {
      type: "audio";
      url: string;
      mimeType?: string | null;
      title?: string | null;
    };

export type NotificationBody = {
  version: 1;
  blocks: NotificationBodyBlock[];
};

export type ToriNotification = {
  id: string;
  subscriptionId: string | null;
  channelId: string;
  botPluginInstanceId: string | null;
  deliveryEndpointId: string | null;
  channelBindingId: string | null;
  externalChannelId: string | null;
  externalChannelName: string | null;
  platform: string | null;
  namespace: string | null;
  status: string;
  title: string | null;
  body: NotificationBody;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ToriNotificationStreamEvent =
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
      notification: ToriNotification;
    };

export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramMessageEntity = {
  type: string;
  offset: number;
  length: number;
};

export type TelegramMessage = {
  message_id: number;
  text?: string;
  date?: number;
  from?: TelegramUser;
  chat: TelegramChat;
  entities?: TelegramMessageEntity[];
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};
