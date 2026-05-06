DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'platform' AND indexname = 'uq_mock_bot_singleton'
  ) THEN
    CREATE UNIQUE INDEX uq_mock_bot_singleton
      ON platform.bot_plugin_instance (platform)
      WHERE platform = 'mock' AND status = 'active';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'platform' AND indexname = 'uq_delivery_endpoint_target'
  ) THEN
    CREATE UNIQUE INDEX uq_delivery_endpoint_target
      ON platform.delivery_endpoint (platform, kind, target)
      WHERE status = 'active';
  END IF;
END $$;

INSERT INTO platform.delivery_endpoint (
  id,
  owner_user_id,
  platform,
  kind,
  display_name,
  target,
  status,
  config,
  metadata,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-00000000de01',
  '__platform__',
  'mock',
  'internal',
  'Platform Mock Delivery Endpoint',
  'internal://bot-plugin-instance/mock/managed/default-mock',
  'active',
  '{}'::jsonb,
  jsonb_build_object('seed', 'default-mock-bot', 'managed', true),
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
SET
  owner_user_id = EXCLUDED.owner_user_id,
  platform = EXCLUDED.platform,
  kind = EXCLUDED.kind,
  display_name = EXCLUDED.display_name,
  target = EXCLUDED.target,
  status = 'active',
  config = EXCLUDED.config,
  metadata = EXCLUDED.metadata,
  updated_at = now();

UPDATE platform.bot_plugin_instance
SET
  status = 'disabled',
  updated_at = now(),
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('disabledByMigration', 'default-mock-bot-singleton')
WHERE platform = 'mock'
  AND status = 'active'
  AND id <> '00000000-0000-0000-0000-00000000b001';

INSERT INTO platform.bot_plugin_instance (
  id,
  owner_user_id,
  platform,
  namespace,
  instance_key,
  display_name,
  callback_mode,
  delivery_endpoint_id,
  status,
  capabilities,
  metadata,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-00000000b001',
  '__platform__',
  'mock',
  'managed',
  'default-mock',
  'Platform Default Mock Bot',
  'internal-sse',
  '00000000-0000-0000-0000-00000000de01',
  'active',
  jsonb_build_object('ingress', true, 'sse', true, 'surface', 'dashboard-mock-bot', 'singleton', true),
  jsonb_build_object('seed', 'default-mock-bot', 'managed', true),
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE
SET
  owner_user_id = EXCLUDED.owner_user_id,
  platform = EXCLUDED.platform,
  namespace = EXCLUDED.namespace,
  instance_key = EXCLUDED.instance_key,
  display_name = EXCLUDED.display_name,
  callback_mode = EXCLUDED.callback_mode,
  delivery_endpoint_id = EXCLUDED.delivery_endpoint_id,
  status = 'active',
  capabilities = EXCLUDED.capabilities,
  metadata = EXCLUDED.metadata,
  updated_at = now();
