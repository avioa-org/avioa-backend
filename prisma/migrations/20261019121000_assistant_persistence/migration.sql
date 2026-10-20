CREATE TABLE "assistant_checkpoints" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "parent_checkpoint_id" TEXT,
    "checkpoint_data" TEXT NOT NULL,
    "metadata_data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_checkpoints_pkey" PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id")
);

CREATE INDEX "assistant_checkpoints_thread_id_checkpoint_ns_created_at_idx"
ON "assistant_checkpoints"("thread_id", "checkpoint_ns", "created_at");

CREATE TABLE "assistant_checkpoint_writes" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "write_index" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "value_data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_checkpoint_writes_pkey" PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "write_index")
);

CREATE TABLE "assistant_pending_actions" (
    "action_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_pending_actions_pkey" PRIMARY KEY ("action_id")
);

CREATE INDEX "assistant_pending_actions_actor_id_thread_id_state_idx"
ON "assistant_pending_actions"("actor_id", "thread_id", "state");

CREATE INDEX "assistant_pending_actions_expires_at_state_idx"
ON "assistant_pending_actions"("expires_at", "state");
