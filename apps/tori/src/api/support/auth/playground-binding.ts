import { and, eq, isNull } from "drizzle-orm";
import { uniqueId } from "@repo/utils/id";
import type { DBOptions } from "@/api/db";
import {
  channelBindings as sqliteChannelBindings,
  channels as sqliteChannels,
  userBindings as sqliteUserBindings,
} from "@/api/db/schema/d1";
import {
  channelBindings as pgChannelBindings,
  channels as pgChannels,
  userBindings as pgUserBindings,
} from "@/api/db/schema/pg";
import type { User } from "@/api/domain/infra";
import type { PGDB, SqliteDB } from "@/api/domain/infra/db";
import {
  DEFAULT_PLAYGROUND_BOT_NAME,
  DEFAULT_PLAYGROUND_BOT_INSTANCE_ID,
  DEFAULT_PLAYGROUND_NAMESPACE,
  DEFAULT_PLAYGROUND_PLATFORM,
  createPlaygroundChannelExternalId,
  createPlaygroundChannelId,
  createPlaygroundUserExternalId,
} from "@/shared/platform/playground";

function resolveUserDisplayName(user: User) {
  return user.name?.trim() || user.email?.trim() || "Tori User";
}

function resolveDefaultChannelName(user: User) {
  return `${resolveUserDisplayName(user)} Trial Channel`;
}

function createDefaultMetadata() {
  return {
    seed: "default-playground-user-binding",
    botInstanceId: DEFAULT_PLAYGROUND_BOT_INSTANCE_ID,
    botDisplayName: DEFAULT_PLAYGROUND_BOT_NAME,
  };
}

export async function ensureDefaultMockBindings(dbOpt: DBOptions, user: User) {
  if (dbOpt.provider === "sqlite") {
    await ensureSqliteDefaultMockBindings(dbOpt.db as SqliteDB, user);
    return;
  }

  await ensurePgDefaultMockBindings(dbOpt.db as PGDB, user);
}

async function ensurePgDefaultMockBindings(db: PGDB, user: User) {
  const externalUserId = createPlaygroundUserExternalId(user.id);
  const externalChannelId = createPlaygroundChannelExternalId(user.id);
  const channelId = createPlaygroundChannelId(user.id);
  const metadata = createDefaultMetadata();

  const [existing] = await db
    .select({ id: pgUserBindings.id })
    .from(pgUserBindings)
    .where(
      and(
        eq(pgUserBindings.platform, DEFAULT_PLAYGROUND_PLATFORM),
        eq(pgUserBindings.externalUserId, externalUserId),
        eq(pgUserBindings.namespace, DEFAULT_PLAYGROUND_NAMESPACE),
        isNull(pgUserBindings.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    await db
      .insert(pgUserBindings)
      .values({
        id: uniqueId(),
        userId: user.id,
        platform: DEFAULT_PLAYGROUND_PLATFORM,
        externalUserId,
        externalUserName: resolveUserDisplayName(user),
        namespace: DEFAULT_PLAYGROUND_NAMESPACE,
        source: "system-default",
        assurance: "session-authenticated",
        metadata,
      })
      .onConflictDoNothing();
  }

  await db
    .insert(pgChannels)
    .values({
      id: channelId,
      type: "dm",
      name: resolveDefaultChannelName(user),
      status: "active",
      createdByUserId: user.id,
      metadata: {
        seed: "default-playground-channel",
        platform: DEFAULT_PLAYGROUND_PLATFORM,
        externalChannelId,
        namespace: DEFAULT_PLAYGROUND_NAMESPACE,
      },
    })
    .onConflictDoNothing();

  await db
    .insert(pgChannelBindings)
    .values({
      id: uniqueId(),
      channelId,
      platform: DEFAULT_PLAYGROUND_PLATFORM,
      externalChannelId,
      externalChannelName: resolveDefaultChannelName(user),
      namespace: DEFAULT_PLAYGROUND_NAMESPACE,
      botPluginInstanceId: DEFAULT_PLAYGROUND_BOT_INSTANCE_ID,
      source: "system-default",
      assurance: "session-authenticated",
      status: "active",
      metadata,
    })
    .onConflictDoNothing();
}

async function ensureSqliteDefaultMockBindings(db: SqliteDB, user: User) {
  const externalUserId = createPlaygroundUserExternalId(user.id);
  const externalChannelId = createPlaygroundChannelExternalId(user.id);
  const channelId = createPlaygroundChannelId(user.id);
  const metadata = createDefaultMetadata();

  const [existing] = await db
    .select({ id: sqliteUserBindings.id })
    .from(sqliteUserBindings)
    .where(
      and(
        eq(sqliteUserBindings.platform, DEFAULT_PLAYGROUND_PLATFORM),
        eq(sqliteUserBindings.externalUserId, externalUserId),
        eq(sqliteUserBindings.namespace, DEFAULT_PLAYGROUND_NAMESPACE),
        isNull(sqliteUserBindings.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) {
    await db
      .insert(sqliteUserBindings)
      .values({
        id: uniqueId(),
        userId: user.id,
        platform: DEFAULT_PLAYGROUND_PLATFORM,
        externalUserId,
        externalUserName: resolveUserDisplayName(user),
        namespace: DEFAULT_PLAYGROUND_NAMESPACE,
        source: "system-default",
        assurance: "session-authenticated",
        metadata,
      })
      .onConflictDoNothing();
  }

  await db
    .insert(sqliteChannels)
    .values({
      id: channelId,
      type: "dm",
      name: resolveDefaultChannelName(user),
      status: "active",
      createdByUserId: user.id,
      metadata: {
        seed: "default-playground-channel",
        platform: DEFAULT_PLAYGROUND_PLATFORM,
        externalChannelId,
        namespace: DEFAULT_PLAYGROUND_NAMESPACE,
      },
    })
    .onConflictDoNothing();

  await db
    .insert(sqliteChannelBindings)
    .values({
      id: uniqueId(),
      channelId,
      platform: DEFAULT_PLAYGROUND_PLATFORM,
      externalChannelId,
      externalChannelName: resolveDefaultChannelName(user),
      namespace: DEFAULT_PLAYGROUND_NAMESPACE,
      botPluginInstanceId: DEFAULT_PLAYGROUND_BOT_INSTANCE_ID,
      source: "system-default",
      assurance: "session-authenticated",
      status: "active",
      metadata,
    })
    .onConflictDoNothing();
}
