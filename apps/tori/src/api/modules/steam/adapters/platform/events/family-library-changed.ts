import { createEventConsumer } from "@/api/domain/infra/eventing";
import {
  createNotificationBody,
  type NotificationBody,
} from "@/api/modules/platform/notification/notification/body";
import { deliverNotificationCandidate } from "@/api/modules/platform/notification/notification/delivery";
import type { SteamFamilyLibraryChangedPayload } from "@/api/modules/steam/core/family/types";

export const STEAM_FAMILY_LIBRARY_CHANGED = "SteamFamilyLibraryChanged";

function createSteamFamilyChangeBody(payload: SteamFamilyLibraryChangedPayload) {
  const blocks: NotificationBody["blocks"] = [
    {
      type: "heading" as const,
      text: `${payload.familyName ?? "Steam family"} library changed.`,
    },
    {
      type: "stats" as const,
      items: [
        {
          label: "Added",
          value: String(payload.addedGames.length),
        },
        {
          label: "Removed",
          value: String(payload.removedGames.length),
        },
        {
          label: "Library Size",
          value: String(payload.librarySize),
        },
      ],
    },
  ];

  if (payload.addedGames.length > 0) {
    blocks.push({
      type: "game-grid" as const,
      title: "Added games",
      items: payload.addedGames.slice(0, 12).map((game) => ({
        appId: String(game.appId),
        title: String(game.name ?? game.appId),
        imageUrl: game.headerImageUrl ?? game.imageUrl ?? null,
        subtitle: `App ${game.appId}`,
      })),
    });
  }

  if (payload.removedGames.length > 0) {
    blocks.push({
      type: "game-grid" as const,
      title: "Removed games",
      items: payload.removedGames.slice(0, 12).map((game) => ({
        appId: String(game.appId),
        title: String(game.name ?? game.appId),
        imageUrl: game.headerImageUrl ?? game.imageUrl ?? null,
        subtitle: `App ${game.appId}`,
      })),
    });
  }

  return createNotificationBody(blocks);
}

export const steamFamilyLibraryChangedConsumer =
  createEventConsumer<SteamFamilyLibraryChangedPayload>(
    "steam.notify.family-library-changed",
    STEAM_FAMILY_LIBRARY_CHANGED,
    async (ctx) => {
      const payload = ctx.event.payload as SteamFamilyLibraryChangedPayload | null;
      if (!payload?.connectionId) {
        return { id: ctx.event.id, status: "DROP", reason: "missing connectionId" };
      }

      const notificationRepository = ctx.repositories.notify;
      const candidates = await notificationRepository.createNotificationCandidates({
        connectionId: payload.connectionId,
        topicType: "steam.family",
        eventType: "family.library.updated",
        title: `${payload.familyName ?? "Steam family"} library changed`,
        body: createSteamFamilyChangeBody(payload),
        payload,
      });

      for (const candidate of candidates) {
        const notification = candidate.notification;
        try {
          await deliverNotificationCandidate(candidate);
          await notificationRepository.markNotificationSent(notification.id);
        } catch (error) {
          await notificationRepository.markNotificationFailed(
            notification.id,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      return { id: ctx.event.id, status: "SUCCESS" };
    },
  );

export const steamEventConsumers = [steamFamilyLibraryChangedConsumer];
