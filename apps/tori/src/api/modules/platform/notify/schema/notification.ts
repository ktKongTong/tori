import { z } from 'zod';

export const notifyEventsSchema = z.object({
  id: z.string(),
  subscriptionId: z.string().nullable(),
  channelId: z.string(),
  botPluginInstanceId: z.string().nullable(),
  deliveryEndpointId: z.string().nullable(),
  channelBindingId: z.string().nullable(),
  title: z.string().nullable(),
  body: z.unknown(),
  payload: z.unknown(),
  status: z.string(),
  sentAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
});
