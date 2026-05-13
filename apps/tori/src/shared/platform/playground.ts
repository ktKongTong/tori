export const DEFAULT_PLAYGROUND_PLATFORM = "playground";
export const DEFAULT_PLAYGROUND_NAMESPACE = "managed";
export const DEFAULT_PLAYGROUND_BOT_INSTANCE_ID = "00000000-0000-0000-0000-00000000b001";
export const DEFAULT_PLAYGROUND_BOT_NAME = "Playground Bot";

export function createPlaygroundUserExternalId(userId: string) {
  return `tori-user-${userId}`;
}

export function createPlaygroundChannelExternalId(userId: string) {
  return `tori-dm-${userId}`;
}

export function createPlaygroundChannelId(userId: string) {
  return `playground-channel-${userId}`;
}
