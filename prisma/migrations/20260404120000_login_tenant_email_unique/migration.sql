-- Vínculo lógico: cada linha em `login` já associa e-mail (`login`) a um `tenant_id`.
-- Índice único (case-insensitive, sem espaços nas pontas) evita duplicados no mesmo abrigo
-- que possam confundir a listagem no login.
CREATE UNIQUE INDEX IF NOT EXISTS "login_tenant_email_lower_trim_unique"
ON "login" ("tenant_id", (LOWER(TRIM(BOTH FROM "login"))));
