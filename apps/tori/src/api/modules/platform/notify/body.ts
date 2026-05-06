import { z } from "zod";

export const notificationBodyBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("text"),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("stats"),
    items: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("list"),
    style: z.enum(["unordered", "ordered"]).default("unordered"),
    items: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal("game-grid"),
    title: z.string().nullable().optional(),
    items: z
      .array(
        z.object({
          appId: z.string().min(1),
          title: z.string().min(1),
          imageUrl: z.string().nullable().optional(),
          subtitle: z.string().nullable().optional(),
        }),
      )
      .min(1),
  }),
  z.object({
    type: z.literal("image"),
    url: z.string().min(1),
    alt: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("audio"),
    url: z.string().min(1),
    mimeType: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
  }),
]);

export const notificationBodySchema = z.object({
  version: z.literal(1),
  blocks: z.array(notificationBodyBlockSchema).min(1),
});

export type NotificationBody = z.infer<typeof notificationBodySchema>;
export type NotificationBodyBlock = z.infer<typeof notificationBodyBlockSchema>;

export function createNotificationBody(blocks: NotificationBody["blocks"]): NotificationBody {
  return {
    version: 1,
    blocks,
  };
}
