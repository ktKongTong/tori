import { ParameterError } from "@/api/domain/error/index.ts";
import { defineTaskHandler } from "@/api/modules/platform/task/registry.ts";

import { refreshSteamFamily } from "../../../core/family/service.ts";

export const steamFamilyRefreshConnectionTaskHandler = defineTaskHandler(
  "steam.family.refresh_connection",
  async (ctx, taskDefinition) => {
    const payload =
      taskDefinition.payload &&
      typeof taskDefinition.payload === "object" &&
      !Array.isArray(taskDefinition.payload)
        ? (taskDefinition.payload as Record<string, unknown>)
        : null;
    const connectionId = typeof payload?.connectionId === "string" ? payload.connectionId : null;
    if (!connectionId) {
      throw new ParameterError("task payload.connectionId is required");
    }

    const result = await refreshSteamFamily(ctx, {
      connectionId,
      ownerUserId: taskDefinition.ownerUserId ?? undefined,
      triggerType: "scheduled",
    });

    return {
      summary: {
        familyId: result.family.id,
        librarySize: result.librarySize,
        addedCount: result.addedGames.length,
        removedCount: result.removedGames.length,
      },
    };
  },
);

export const steamTaskHandlers = [steamFamilyRefreshConnectionTaskHandler];
