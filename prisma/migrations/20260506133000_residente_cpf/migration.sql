-- Add CPF field to residents
ALTER TABLE "residente"
ADD COLUMN "cpf" VARCHAR(14);

-- Unique CPF per tenant (NULL allowed multiple times)
CREATE UNIQUE INDEX "uq_residente_tenant_cpf"
ON "residente" ("tenant_id", "cpf");

