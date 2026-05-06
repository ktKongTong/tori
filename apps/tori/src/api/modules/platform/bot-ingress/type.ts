import { z } from "zod";

export const messageContextSchema = z.object({
  platform: z.string().min(1),
  observedUserId: z.string().min(1),
  observedUserName: z.string().min(1),
  observedChannelId: z.string().min(1),
  observedChannelName: z.string().min(1),
  namespace: z.string().nullable().optional(),
  channelType: z.string().default("dm"),
  channelName: z.string().min(1),
  rawPayload: z.record(z.string(), z.any()).optional(),
});

export const commandRequestSchema = z.object({
  commandName: z.string().min(1),
  commandParams: z.array(z.string()).default([]),
  messageContext: messageContextSchema,
});

export const botCommandContextSnapshotSchema = z.object({
  userId: z.string().nullable(),
  channelId: z.string(),
  anonymousUserId: z.string().nullable(),
  userBindingId: z.string().nullable(),
  channelBindingId: z.string(),
  namespace: z.string(),
});

export type BotCommandContextSnapshot = z.infer<typeof botCommandContextSnapshotSchema>;

export type MessageContextInput = z.infer<typeof messageContextSchema>;
export type CommandRequestInput = z.infer<typeof commandRequestSchema>;

export const DEFAULT_BOT_NAMESPACE = "managed";

export function resolveMessageContextNamespace(
  messageContext: Pick<MessageContextInput, "namespace">,
) {
  return messageContext.namespace ?? DEFAULT_BOT_NAMESPACE;
}
