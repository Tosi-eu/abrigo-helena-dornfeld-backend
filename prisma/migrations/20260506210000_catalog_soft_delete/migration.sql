-- AlterTable
ALTER TABLE "medicamento" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "insumo" ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "medicamento" DROP CONSTRAINT IF EXISTS "uniq_medicamento_tenant_nome_principio_dosagem";
ALTER TABLE "insumo" DROP CONSTRAINT IF EXISTS "uniq_insumo_tenant_nome";

CREATE UNIQUE INDEX "uniq_medicamento_tenant_catalog_active"
ON "medicamento" ("tenant_id", "nome", "principio_ativo", "dosagem", "unidade_medida")
WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uniq_insumo_tenant_nome_active"
ON "insumo" ("tenant_id", "nome")
WHERE "deleted_at" IS NULL;
