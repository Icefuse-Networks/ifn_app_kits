-- CreateTable
CREATE TABLE "api_token" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "token_prefix" VARCHAR(8) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['kits:read']::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_config" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "kit_data" TEXT NOT NULL,
    "store_data" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kit_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_server" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "port" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "icon_url" TEXT NOT NULL,
    "wipe_config" TEXT,
    "bot_token" VARCHAR(255),
    "kit_config_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "actor_type" VARCHAR(20) NOT NULL,
    "actor_id" TEXT NOT NULL,
    "old_values" TEXT,
    "new_values" TEXT,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_token_token_hash_key" ON "api_token"("token_hash");

-- CreateIndex
CREATE INDEX "api_token_token_hash_idx" ON "api_token"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "kit_config_name_key" ON "kit_config"("name");

-- CreateIndex
CREATE INDEX "game_server_kit_config_id_idx" ON "game_server"("kit_config_id");

-- CreateIndex
CREATE INDEX "audit_log_resource_type_resource_id_idx" ON "audit_log"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- AddForeignKey
ALTER TABLE "game_server" ADD CONSTRAINT "game_server_kit_config_id_fkey" FOREIGN KEY ("kit_config_id") REFERENCES "kit_config"("id") ON DELETE SET NULL ON UPDATE CASCADE;
