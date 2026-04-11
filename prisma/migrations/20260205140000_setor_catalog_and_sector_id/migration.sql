-- Catálogo de setores por tenant + FK opcional em estoque/movimentação (backfill a partir de `setor` texto).

CREATE TABLE IF NOT EXISTS "setor" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "proportion_profile" VARCHAR(20) NOT NULL DEFAULT 'farmacia',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_setor_tenant_key" ON "setor"("tenant_id", "key");
CREATE INDEX IF NOT EXISTS "idx_setor_tenant_id" ON "setor"("tenant_id");

-- Idempotente: base já pode ter sido criada com db push / execução repetida.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'setor_tenant_id_fkey'
  ) THEN
    ALTER TABLE "setor" ADD CONSTRAINT "setor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "setor" ("tenant_id", "key", "nome", "proportion_profile", "sort_order", "updated_at")
SELECT t.id, 'farmacia', 'Farmácia', 'farmacia', 0, CURRENT_TIMESTAMP
FROM "tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "setor" s WHERE s.tenant_id = t.id AND s.key = 'farmacia'
);

INSERT INTO "setor" ("tenant_id", "key", "nome", "proportion_profile", "sort_order", "updated_at")
SELECT t.id, 'enfermagem', 'Enfermagem', 'enfermagem', 1, CURRENT_TIMESTAMP
FROM "tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "setor" s WHERE s.tenant_id = t.id AND s.key = 'enfermagem'
);

ALTER TABLE "estoque_medicamento" ADD COLUMN IF NOT EXISTS "sector_id" INTEGER;
ALTER TABLE "estoque_insumo" ADD COLUMN IF NOT EXISTS "sector_id" INTEGER;
ALTER TABLE "movimentacao" ADD COLUMN IF NOT EXISTS "sector_id" INTEGER;

UPDATE "estoque_medicamento" em
SET "sector_id" = COALESCE(
  (SELECT s.id FROM "setor" s WHERE s.tenant_id = em.tenant_id AND s.key = em.setor LIMIT 1),
  (SELECT s.id FROM "setor" s WHERE s.tenant_id = em.tenant_id AND s.key = 'farmacia' LIMIT 1)
)
WHERE em.sector_id IS NULL;

UPDATE "estoque_insumo" ei
SET "sector_id" = COALESCE(
  (SELECT s.id FROM "setor" s WHERE s.tenant_id = ei.tenant_id AND s.key = ei.setor LIMIT 1),
  (SELECT s.id FROM "setor" s WHERE s.tenant_id = ei.tenant_id AND s.key = 'farmacia' LIMIT 1)
)
WHERE ei.sector_id IS NULL;

UPDATE "movimentacao" m
SET "sector_id" = COALESCE(
  (SELECT s.id FROM "setor" s WHERE s.tenant_id = m.tenant_id AND s.key = m.setor LIMIT 1),
  (SELECT s.id FROM "setor" s WHERE s.tenant_id = m.tenant_id AND s.key = 'farmacia' LIMIT 1)
)
WHERE m.sector_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estoque_medicamento_sector_id_fkey'
  ) THEN
    ALTER TABLE "estoque_medicamento" ADD CONSTRAINT "estoque_medicamento_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estoque_insumo_sector_id_fkey'
  ) THEN
    ALTER TABLE "estoque_insumo" ADD CONSTRAINT "estoque_insumo_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimentacao_sector_id_fkey'
  ) THEN
    ALTER TABLE "movimentacao" ADD CONSTRAINT "movimentacao_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "setor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_estoque_medicamento_tenant_sector_id" ON "estoque_medicamento"("tenant_id", "sector_id");
CREATE INDEX IF NOT EXISTS "idx_estoque_insumo_tenant_sector_id" ON "estoque_insumo"("tenant_id", "sector_id");
