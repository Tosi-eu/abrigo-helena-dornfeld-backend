-- Integração API de preços (antes PRICING_API_URL / PRICING_API_KEY no ambiente).
INSERT INTO "system_config" ("key", "value", "created_at", "updated_at")
VALUES
  ('runtime.pricing.base_url', '', now(), now()),
  ('runtime.pricing.api_key', '', now(), now())
ON CONFLICT ("key") DO NOTHING;
