-- AlterTable (idempotente: db push pode já ter criado a coluna)
ALTER TABLE "residente" ADD COLUMN IF NOT EXISTS "data_nascimento" DATE;
