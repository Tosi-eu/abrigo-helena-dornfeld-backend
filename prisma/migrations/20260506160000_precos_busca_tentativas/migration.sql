-- AlterTable
ALTER TABLE "medicamento" ADD COLUMN "preco_busca_tentativas" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "insumo" ADD COLUMN "preco_busca_tentativas" INTEGER NOT NULL DEFAULT 0;
