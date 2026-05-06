ALTER TABLE "platform"."notification_event"
ALTER COLUMN "body" SET DATA TYPE jsonb
USING jsonb_build_object(
  'version',
  1,
  'blocks',
  jsonb_build_array(
    jsonb_build_object(
      'type',
      'text',
      'text',
      "body"
    )
  )
);
