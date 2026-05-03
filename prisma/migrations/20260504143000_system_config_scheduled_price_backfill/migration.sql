-- Agendamento Temporal + cooldown manual (antes ENABLE_PRICE_BACKFILL_CRON, PRICE_BACKFILL_CRON, PRICE_BACKFILL_MANUAL_* no `.env`).
INSERT INTO "system_config" ("key", "value", "created_at", "updated_at")
VALUES
  ('runtime.scheduled_price_backfill.enabled', 'true', NOW(), NOW()),
  ('runtime.scheduled_price_backfill.cron_expression', '15 */2 * * *', NOW(), NOW()),
  ('runtime.scheduled_price_backfill.manual_cooldown_success_sec', '60', NOW(), NOW()),
  ('runtime.scheduled_price_backfill.manual_cooldown_error_sec', '300', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
