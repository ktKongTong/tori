import type { IDashboardRepository } from "./repository";

const stringValue = (value: unknown, fallback = "unknown") => {
  return typeof value === "string" && value.length > 0 ? value : fallback;
};

export async function getDashboardBinding(repo: IDashboardRepository) {
  const { users, channelsList, claims, userRows, channelRows, botInstances } =
    await repo.listBindingRows();

  const userBindingsPayload = users.flatMap((row) => {
    if (row.status !== "active") return [];

    const boundUser = userRows.find((item) => item.id === row.userId);
    const userName = boundUser?.name?.trim();
    const externalUserName = row.externalUserName?.trim();

    if (!boundUser || boundUser.isAnonymous || !userName || !externalUserName) {
      return [];
    }

    return [
      {
        id: row.id,
        userId: row.userId,
        userName,
        platform: row.platform,
        externalUserId: row.externalUserId,
        externalUserName,
        assurance: row.assurance,
      },
    ];
  });

  const channelBindingsPayload = channelsList.flatMap((row) => {
    if (row.status !== "active") return [];

    const channelName = channelRows.find((item) => item.id === row.channelId)?.name?.trim();
    const externalChannelName = row.externalChannelName?.trim();
    const botInstanceName = botInstances
      .find((item) => item.id === row.botPluginInstanceId)
      ?.displayName?.trim();

    if (!channelName || !externalChannelName || !botInstanceName) {
      return [];
    }

    return [
      {
        id: row.id,
        channelId: row.channelId,
        channelName,
        platform: row.platform,
        externalChannelId: row.externalChannelId,
        externalChannelName,
        botPluginInstanceId: row.botPluginInstanceId ?? null,
        botInstanceName,
      },
    ];
  });

  const claimSessionsPayload = claims.flatMap((row) => {
    const anonymousUserName = row.anonymousUserName?.trim();
    const observedUserName = row.observedUserName?.trim();
    const observedChannelName = row.observedChannelName?.trim();
    const platform = (row.observedUserPlatform ?? row.observedChannelPlatform ?? "").trim();

    if (!anonymousUserName || !observedUserName || !observedChannelName || !platform) {
      return [];
    }

    return [
      {
        id: row.id,
        purpose: row.purpose,
        status: row.status,
        anonymousUserId: row.anonymousUserId,
        anonymousUserName,
        platform,
        observedUserId: row.observedUserId,
        observedUserName,
        observedChannelId: row.observedChannelId,
        observedChannelName,
      },
    ];
  });

  return {
    userBindings: userBindingsPayload,
    channelBindings: channelBindingsPayload,
    claimSessions: claimSessionsPayload,
  };
}

export async function getDashboardIntegration(repo: IDashboardRepository) {
  const { proxies, conns, profiles } = await repo.listIntegrationRows();
  return {
    proxyInstances: proxies.map((row) => ({
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name ?? "—",
      provider: row.provider,
      baseUrl: row.baseUrl,
      status: row.status,
      healthStatus: row.healthStatus,
      providers: Array.isArray((row.capabilities as Record<string, unknown> | null)?.providers)
        ? (
            (row.capabilities as Record<string, unknown>).providers as Array<
              Record<string, unknown>
            >
          ).map((item) => ({
            name: stringValue(item.name),
            flow: stringValue(item.flow),
            grantType: stringValue(item.grantType ?? item.grant_type),
          }))
        : [],
    })),
    connections: conns.map((row) => {
      const accountProfile = profiles.find((profile) => profile.connectionId === row.id) ?? null;

      return {
        id: row.id,
        ownerUserId: row.ownerUserId,
        provider: row.provider,
        providerAccountName: row.providerAccountName ?? null,
        accountLabel: row.providerAccountName ?? row.providerAccountId,
        providerAccountId: row.providerAccountId,
        accessMode: row.accessMode,
        proxyInstanceId: row.proxyInstanceId,
        proxyName: proxies.find((proxy) => proxy.id === row.proxyInstanceId)?.name ?? null,
        isDefault: row.isDefault,
        status: row.status,
        accountProfile: accountProfile
          ? {
              externalAccountId: accountProfile.externalAccountId,
              displayName: accountProfile.displayName ?? null,
              avatarUrl: accountProfile.avatarUrl ?? null,
              profileUrl: accountProfile.profileUrl ?? null,
              lastSyncedAt: accountProfile.lastSyncedAt?.toISOString() ?? null,
            }
          : null,
      };
    }),
  };
}

export async function getDashboardBotInstances(repo: IDashboardRepository) {
  const { instances, endpoints } = await repo.listBotInstanceRows();

  return {
    instances: instances.map((row) => ({
      id: row.id,
      ownerUserId: row.ownerUserId,
      platform: row.platform,
      namespace: row.namespace ?? "managed",
      instanceKey: row.instanceKey,
      displayName: row.displayName ?? "—",
      callbackMode: row.callbackMode,
      deliveryEndpointId: row.deliveryEndpointId ?? null,
      deliveryEndpointLabel:
        endpoints.find((endpoint) => endpoint.id === row.deliveryEndpointId)?.displayName ??
        endpoints.find((endpoint) => endpoint.id === row.deliveryEndpointId)?.target ??
        null,
      status: row.status,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    })),
    deliveryEndpoints: endpoints.map((row) => ({
      id: row.id,
      platform: row.platform,
      kind: row.kind,
      displayName: row.displayName ?? "—",
      target: row.target,
      status: row.status,
    })),
  };
}

export async function getDashboardNotify(repo: IDashboardRepository, isAdmin: boolean) {
  const { webhooks, subs, notifications, channelRows, connectionRows, userRows, botInstances } =
    await repo.listNotifyRows();
  return {
    deliveryEndpoints: isAdmin
      ? webhooks.map((row) => ({
          id: row.id,
          platform: row.platform,
          kind: row.kind,
          displayName: row.displayName ?? "—",
          target: row.target,
          status: row.status,
        }))
      : [],
    subscriptions: subs.map((row) => ({
      id: row.id,
      channelId: row.channelId,
      channelLabel: channelRows.find((item) => item.id === row.channelId)?.name ?? row.channelId,
      botPluginInstanceId: row.botPluginInstanceId,
      botPluginInstanceLabel:
        botInstances.find((item) => item.id === row.botPluginInstanceId)?.displayName ??
        botInstances.find((item) => item.id === row.botPluginInstanceId)?.instanceKey ??
        row.botPluginInstanceId,
      connectionId: row.connectionId,
      connectionLabel:
        connectionRows.find((item) => item.id === row.connectionId)?.providerAccountName ??
        connectionRows.find((item) => item.id === row.connectionId)?.providerAccountId ??
        row.connectionId,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      ownerLabel:
        row.ownerType === "USER"
          ? (userRows.find((item) => item.id === row.ownerId)?.name ?? row.ownerId)
          : (channelRows.find((item) => item.id === row.ownerId)?.name ?? row.ownerId),
      topicType: row.topicType,
      topicKey: row.topicKey,
      status: row.status,
    })),
    notificationEvents: notifications.map((row) => ({
      id: row.id,
      subscriptionId: row.subscriptionId,
      subscriptionLabel:
        subs.find((item) => item.id === row.subscriptionId)?.topicType ?? row.subscriptionId,
      channelId: row.channelId,
      channelLabel: channelRows.find((item) => item.id === row.channelId)?.name ?? row.channelId,
      botPluginInstanceId: row.botPluginInstanceId ?? null,
      botPluginInstanceLabel:
        botInstances.find((item) => item.id === row.botPluginInstanceId)?.displayName ??
        botInstances.find((item) => item.id === row.botPluginInstanceId)?.instanceKey ??
        row.botPluginInstanceId,
      deliveryEndpointId: isAdmin ? (row.deliveryEndpointId ?? null) : null,
      deliveryEndpointLabel: isAdmin
        ? (webhooks.find((item) => item.id === row.deliveryEndpointId)?.displayName ??
          webhooks.find((item) => item.id === row.deliveryEndpointId)?.target ??
          row.deliveryEndpointId)
        : null,
      title: row.title ?? null,
      body: row.body,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function getDashboardNotifySubscriptions(repo: IDashboardRepository) {
  const notify = await getDashboardNotify(repo, true);
  return { subscriptions: notify.subscriptions };
}

export async function getDashboardNotifyEvents(repo: IDashboardRepository, isAdmin: boolean) {
  const notify = await getDashboardNotify(repo, isAdmin);
  return { notificationEvents: notify.notificationEvents };
}

export async function getDashboardNotifyDeliveryEndpoints(
  repo: IDashboardRepository,
  isAdmin: boolean,
) {
  const notify = await getDashboardNotify(repo, isAdmin);
  return { deliveryEndpoints: notify.deliveryEndpoints };
}

export async function getDashboardTasks(repo: IDashboardRepository, isAdmin: boolean) {
  if (!isAdmin) return { tasks: [] };

  const { tasks, connectionRows } = await repo.listTaskRows();
  return {
    tasks: tasks.flatMap((row) => {
      const payload =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : null;
      const connectionId = typeof payload?.connectionId === "string" ? payload.connectionId : null;

      return [
        {
          id: row.id,
          kind: row.kind,
          schedule: row.schedule,
          enabled: row.enabled === 1,
          connectionId,
          connectionLabel: connectionId
            ? (connectionRows.find((item) => item.id === connectionId)?.providerAccountName ??
              connectionRows.find((item) => item.id === connectionId)?.providerAccountId ??
              connectionId)
            : null,
          lastRunStatus: row.lastRunStatus ?? null,
        },
      ];
    }),
  };
}
