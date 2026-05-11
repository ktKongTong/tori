import { z } from "zod";

export const actionCheckRequestSchema = z.object({
  action: z.enum(["disable", "enable", "delete", "revoke"]),
});

export const actionCheckResponseSchema = z.object({
  resource: z.object({
    type: z.string(),
    id: z.string(),
    label: z.string().nullable(),
    currentStatus: z.string().nullable(),
  }),
  action: z.enum(["disable", "enable", "delete", "revoke"]),
  allowed: z.boolean(),
  severity: z.enum(["info", "warning", "danger"]),
  summary: z.string(),
  blocking: z.array(z.unknown()),
  affected: z.array(z.unknown()),
  asyncEffects: z.array(z.unknown()),
  retained: z.array(z.unknown()),
  internalCleanup: z.array(z.unknown()),
  runtimeEffects: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ActionCheckAction = z.infer<typeof actionCheckRequestSchema>["action"];

type ActionCheckInput = {
  resource: {
    type: string;
    id: string;
    label?: string | null;
    currentStatus?: string | null;
  };
  action: ActionCheckAction;
  summary: string;
  severity?: "info" | "warning" | "danger";
  allowed?: boolean;
  affected?: unknown[];
  asyncEffects?: unknown[];
  retained?: unknown[];
  internalCleanup?: unknown[];
  runtimeEffects?: string[];
  blocking?: unknown[];
  warnings?: string[];
};

export function createActionCheckResponse(input: ActionCheckInput) {
  return {
    resource: {
      type: input.resource.type,
      id: input.resource.id,
      label: input.resource.label ?? null,
      currentStatus: input.resource.currentStatus ?? null,
    },
    action: input.action,
    allowed: input.allowed ?? true,
    severity: input.severity ?? "warning",
    summary: input.summary,
    blocking: input.blocking ?? [],
    affected: input.affected ?? [],
    asyncEffects: input.asyncEffects ?? [],
    retained: input.retained ?? [],
    internalCleanup: input.internalCleanup ?? [],
    runtimeEffects: input.runtimeEffects ?? [],
    warnings: input.warnings ?? [],
  };
}
