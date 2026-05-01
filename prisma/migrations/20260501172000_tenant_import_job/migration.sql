-- CreateTable
CREATE TABLE IF NOT EXISTS "tenant_import_job" (
  "id" VARCHAR(64) NOT NULL,
  "tenant_id" INTEGER NOT NULL,
  "actor_user_id" INTEGER NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "file_path" VARCHAR(512) NOT NULL,
  "options_json" JSONB,
  "result_json" JSONB,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "tenant_import_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tenant_import_job_tenant_id" ON "tenant_import_job"("tenant_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tenant_import_job_tenant_created_at" ON "tenant_import_job"("tenant_id", "created_at");

