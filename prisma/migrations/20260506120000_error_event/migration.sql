-- CreateTable
CREATE TABLE "error_event" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(20) NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "code" VARCHAR(60),
    "message_raw" TEXT NOT NULL,
    "message_sanitized" TEXT,
    "fingerprint" VARCHAR(40) NOT NULL,
    "context_json" JSONB,
    "stack" TEXT,
    "correlation_id" VARCHAR(80),
    "tenant_id" INTEGER,
    "http_method" VARCHAR(10),
    "http_path" VARCHAR(500),
    "http_status" INTEGER,
    "workflow_id" VARCHAR(120),
    "workflow_run_id" VARCHAR(120),
    "origin_app" VARCHAR(40),

    CONSTRAINT "error_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_error_event_occurred_at" ON "error_event"("occurred_at");

-- CreateIndex
CREATE INDEX "idx_error_event_source_occurred_at" ON "error_event"("source", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_error_event_fingerprint" ON "error_event"("fingerprint");

-- CreateIndex
CREATE INDEX "idx_error_event_correlation_id" ON "error_event"("correlation_id");
