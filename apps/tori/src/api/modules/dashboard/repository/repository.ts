import type {
  ConnectionRow,
  ProxyInstanceRow,
} from "@/api/domain/platform/repository/ports/connection.ts";
import type {
  DeliveryEndpointRow,
  NotificationEventRow,
} from "@/api/domain/platform/repository/ports/notify.ts";
import type { SubscriptionRow } from "@/api/domain/platform/repository/ports/subscription.ts";
import type { TaskDefinitionRow, TaskRunRow } from "@/api/domain/infra/repository/ports/task.ts";

export interface DashboardUserBindingRow {
  id: string;
  userId: string;
  platform: string;
  externalUserId: string;
  externalUserName: string | null;
  assurance: string;
  status: string;
}

export interface DashboardChannelBindingRow {
  id: string;
  channelId: string;
  platform: string;
  externalChannelId: string;
  externalChannelName: string | null;
  botPluginInstanceId: string | null;
  status: string;
}

export interface DashboardClaimSessionRow {
  id: string;
  purpose: string;
  status: string;
  anonymousUserId: string | null;
  anonymousUserName: string | null;
  observedUserPlatform: string | null;
  observedUserId: string | null;
  observedUserName: string | null;
  observedChannelPlatform: string | null;
  observedChannelId: string | null;
  observedChannelName: string | null;
}

export interface DashboardUserRow {
  id: string;
  name: string;
  isAnonymous: boolean | null;
}

export interface DashboardChannelRow {
  id: string;
  name: string | null;
}

export interface DashboardBotInstanceRow {
  id: string;
  ownerUserId: string;
  platform: string;
  namespace: string | null;
  instanceKey: string;
  displayName: string | null;
  callbackMode: string;
  deliveryEndpointId: string | null;
  metadata: unknown;
  status: string;
  lastSeenAt: Date | null;
}

export interface DashboardAccountProfileRow {
  connectionId: string;
  externalAccountId: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  lastSyncedAt: Date | null;
}

export interface DashboardBindingRows {
  users: DashboardUserBindingRow[];
  channelsList: DashboardChannelBindingRow[];
  claims: DashboardClaimSessionRow[];
  userRows: DashboardUserRow[];
  channelRows: DashboardChannelRow[];
  botInstances: DashboardBotInstanceRow[];
}

export interface DashboardIntegrationRows {
  proxies: ProxyInstanceRow[];
  conns: ConnectionRow[];
  profiles: DashboardAccountProfileRow[];
}

export interface DashboardBotInstanceRows {
  instances: DashboardBotInstanceRow[];
  endpoints: DeliveryEndpointRow[];
}

export interface DashboardNotifyRows {
  webhooks: DeliveryEndpointRow[];
  subs: SubscriptionRow[];
  notifications: NotificationEventRow[];
  channelRows: DashboardChannelRow[];
  connectionRows: ConnectionRow[];
  userRows: DashboardUserRow[];
  botInstances: DashboardBotInstanceRow[];
}

export interface DashboardTaskRows {
  tasks: TaskDefinitionRow[];
  connectionRows: ConnectionRow[];
}

export interface DashboardTaskDetailRows {
  task: TaskDefinitionRow | null;
  runs: TaskRunRow[];
  totalRuns: number;
  connectionRows: ConnectionRow[];
}

export interface IDashboardRepository {
  listBindingRows(): Promise<DashboardBindingRows>;
  listIntegrationRows(): Promise<DashboardIntegrationRows>;
  listBotInstanceRows(): Promise<DashboardBotInstanceRows>;
  listNotifyRows(): Promise<DashboardNotifyRows>;
  listTaskRows(): Promise<DashboardTaskRows>;
  getTaskDetailRows(
    taskDefinitionId: string,
    input: { limit: number; offset: number },
  ): Promise<DashboardTaskDetailRows>;
}
