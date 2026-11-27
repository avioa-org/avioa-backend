-- CreateTable
CREATE TABLE "offers_workspace_state" (
    "id" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_workspace_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers_audit_history" (
    "revision" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "payload" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "offers_audit_history_pkey" PRIMARY KEY ("revision")
);

-- CreateTable
CREATE TABLE "offers_workspace_roles" (
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "offers_workspace_roles_pkey" PRIMARY KEY ("user_id")
);
