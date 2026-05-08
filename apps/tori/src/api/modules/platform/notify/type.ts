export interface RegisterDeliveryEndpointInput {
  platform: string;
  kind: string;
  target: string;
  displayName?: string | null;
  secret?: string | null;
  config?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}
