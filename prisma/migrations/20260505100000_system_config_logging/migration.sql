-- Nível e formato de logs da API (antes LOG_LEVEL / LOG_FORMAT no `.env`).
INSERT INTO "system_config" ("key", "value", "created_at", "updated_at")
VALUES
  ('runtime.logging.level', 'debug', NOW(), NOW()),
  ('runtime.logging.format', 'pretty', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
