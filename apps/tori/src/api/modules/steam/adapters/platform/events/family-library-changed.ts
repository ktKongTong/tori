import { createEventConsumer } from "@/api/domain/infra/eventing";
import { createNotificationBody } from "@/api/modules/platform/notification/notification/body";
import { deliverNotificationCandidate } from "@/api/modules/platform/notification/notification/delivery";
import type { SteamFamilyLibraryChangedPayload } from "@/api/modules/steam/core/family/types";

export const STEAM_FAMILY_LIBRARY_CHANGED = "SteamFamilyLibraryChanged";

function createSteamFamilyChangeBody(payload: SteamFamilyLibraryChangedPayload) {
  return createNotificationBody({
    eventType: "steam.family.library.updated",
    subject: payload.familyId ?? payload.connectionId,
    data: {
      connectionId: payload.connectionId,
      familyId: payload.familyId,
      familyName: payload.familyName ?? null,
      librarySize: payload.librarySize,
      syncedAt: payload.syncedAt,
      members: payload.members.map((member) => ({
        steamId: member.steamId,
        role: member.role ?? null,
        personaName: member.personaName ?? null,
        avatarUrl: member.avatarUrl ?? null,
      })),
      counts: {
        added: payload.addedGames.length,
        removed: payload.removedGames.length,
      },
      addedGames: payload.addedGames.map((game) => ({
        appId: game.appId,
        name: game.name ?? null,
        imageUrl: game.imageUrl ?? null,
        headerImageUrl: game.headerImageUrl ?? null,
        ownerSteamIds: game.ownerSteamIds,
        owners: game.owners.map((owner) => ({
          steamId: owner.steamId,
          role: owner.role ?? null,
          personaName: owner.personaName ?? null,
          avatarUrl: owner.avatarUrl ?? null,
        })),
      })),
      removedGames: payload.removedGames.map((game) => ({
        appId: game.appId,
        name: game.name ?? null,
        imageUrl: game.imageUrl ?? null,
        headerImageUrl: game.headerImageUrl ?? null,
        ownerSteamIds: game.ownerSteamIds,
        owners: game.owners.map((owner) => ({
          steamId: owner.steamId,
          role: owner.role ?? null,
          personaName: owner.personaName ?? null,
          avatarUrl: owner.avatarUrl ?? null,
        })),
      })),
    },
  });
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
