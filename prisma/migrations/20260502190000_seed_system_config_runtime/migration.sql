-- Valores por omissão alinhados a `getBuiltinDefaultSystemConfig()` no código.
INSERT INTO "system_config" ("key", "value", "created_at", "updated_at")
VALUES
  ('runtime.cors.allowed_origins', '["http://localhost:5173","http://localhost:3000","http://127.0.0.1:5173","http://127.0.0.1:3000"]', now(), now()),
  ('runtime.ttl.healthcheck_ms', '10000', now(), now()),
  ('runtime.ttl.auth_cache_seconds', '30', now(), now()),
  ('runtime.ttl.r2_logo_list_ms', '600000', now(), now()),
  ('runtime.ttl.jwt_expires_in', '6h', now(), now()),
  ('runtime.ttl.allow_cookie_auth', 'false', now(), now()),
  ('runtime.retries.pricing_api.max', '5', now(), now()),
  ('runtime.retries.pricing_api.base_ms', '800', now(), now()),
  ('runtime.retries.pricing_api.max_ms', '15000', now(), now()),
  ('runtime.concurrency.pricing_api.parallel', '1', now(), now()),
  ('runtime.concurrency.pricing_api.min_interval_ms', '900', now(), now()),
  ('runtime.concurrency.price_backfill.batch', '40', now(), now()),
  ('runtime.concurrency.price_backfill.max_per_tenant', '80', now(), now()),
  ('runtime.concurrency.price_backfill.inter_request_delay_ms', '300', now(), now()),
  ('runtime.rate_limits.global.window_ms', '900000', now(), now()),
  ('runtime.rate_limits.global.max', '1000', now(), now()),
  ('runtime.rate_limits.public_tenant.window_ms', '60000', now(), now()),
  ('runtime.rate_limits.public_tenant.list_max', '120', now(), now()),
  ('runtime.rate_limits.public_tenant.branding_max', '120', now(), now())
ON CONFLICT ("key") DO NOTHING;
