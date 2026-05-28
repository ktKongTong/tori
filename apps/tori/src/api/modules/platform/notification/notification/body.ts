import { z } from "zod";

export const notificationBodySchema = z.object({
  version: z.literal(1),
  eventType: z.string().min(1),
  subject: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()),
});

export type NotificationBody = z.infer<typeof notificationBodySchema>;

export function createNotificationBody(input: Omit<NotificationBody, "version">): NotificationBody {
  return {
    version: 1,
    ...input,
  };
}
