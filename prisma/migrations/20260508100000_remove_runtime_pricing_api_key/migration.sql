-- Chave de API de preços só via PRICING_API_KEY no ambiente (não persiste em system_config).
DELETE FROM "system_config" WHERE "key" = 'runtime.pricing.api_key';
