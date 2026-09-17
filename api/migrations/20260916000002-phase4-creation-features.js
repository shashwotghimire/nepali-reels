"use strict";

async function addColumnIfMissing(q, table, column, definition, transaction) {
  const columns = await q.describeTable(table, { transaction });
  if (!columns[column]) await q.addColumn(table, column, definition, { transaction });
}
async function createTableIfMissing(q, table, definition, transaction) {
  const tables = await q.showAllTables({ transaction });
  const names = tables.map((value) => typeof value === "string" ? value : value.tableName);
  if (!names.includes(table)) await q.createTable(table, definition, { transaction });
}
async function addIndexIfMissing(q, table, fields, options) {
  const indexes = await q.showIndex(table, { transaction: options.transaction });
  if (!indexes.some((index) => index.name === options.name)) await q.addIndex(table, fields, options);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // PostgreSQL requires enum additions to commit before the value is used.
    // The remaining idempotent changes run atomically in the next transaction.
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_reels_pipelineStatus\" ADD VALUE IF NOT EXISTS 'awaiting_script_approval'",
    );
    await queryInterface.sequelize.transaction(async (transaction) => {
      const add = (name, definition) => addColumnIfMissing(queryInterface, "reels", name, definition, transaction);
      await add("scriptVersion", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
      await add("scriptRevisionCount", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
      await add("scriptApprovedAt", { type: Sequelize.DATE, allowNull: true });
      await add("approvedScriptFingerprint", { type: Sequelize.STRING, allowNull: true });
      await add("captionPreset", { type: Sequelize.STRING, allowNull: false, defaultValue: "default" });
      await add("channelStyle", { type: Sequelize.JSONB, allowNull: true });
      await add("thumbnailVersions", { type: Sequelize.JSONB, allowNull: true });
      await add("selectedThumbnailVersion", { type: Sequelize.INTEGER, allowNull: true });
      await add("nextThumbnailVersion", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 2 });
      await add("autoPublishRequested", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });

      await createTableIfMissing(queryInterface, "channel_styles", {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        userId: { type: Sequelize.STRING, allowNull: false, references: { model: "user", key: "id" }, onDelete: "CASCADE" },
        name: { type: Sequelize.STRING, allowNull: false }, channelName: { type: Sequelize.STRING, allowNull: false },
        logoUrl: { type: Sequelize.STRING, allowNull: true }, captionPreset: { type: Sequelize.STRING, allowNull: false, defaultValue: "default" },
        createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, transaction);
      await addIndexIfMissing(queryInterface, "channel_styles", ["userId", "name"], { name: "channel_styles_user_name_unique", unique: true, transaction });

      await createTableIfMissing(queryInterface, "script_revision_requests", {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        pipelineId: { type: Sequelize.UUID, allowNull: false, references: { model: "reels", key: "id" }, onDelete: "CASCADE" },
        userId: { type: Sequelize.STRING, allowNull: false }, idempotencyKey: { type: Sequelize.STRING, allowNull: false },
        scriptVersion: { type: Sequelize.INTEGER, allowNull: false }, status: { type: Sequelize.STRING, allowNull: false },
        instruction: { type: Sequelize.TEXT, allowNull: true },
        result: { type: Sequelize.JSONB, allowNull: true }, leaseOwner: { type: Sequelize.STRING, allowNull: false },
        leaseExpiresAt: { type: Sequelize.DATE, allowNull: false }, error: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, transaction);
      await addColumnIfMissing(queryInterface, "script_revision_requests", "leaseOwner", { type: Sequelize.STRING, allowNull: false, defaultValue: "migration-recovery" }, transaction);
      await addColumnIfMissing(queryInterface, "script_revision_requests", "leaseExpiresAt", { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") }, transaction);
      await addColumnIfMissing(queryInterface, "script_revision_requests", "error", { type: Sequelize.TEXT, allowNull: true }, transaction);
      await addColumnIfMissing(queryInterface, "script_revision_requests", "instruction", { type: Sequelize.TEXT, allowNull: true }, transaction);
      await addIndexIfMissing(queryInterface, "script_revision_requests", ["pipelineId", "idempotencyKey"], { name: "script_revision_pipeline_key_unique", unique: true, transaction });

      await createTableIfMissing(queryInterface, "thumbnail_generation_requests", {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        pipelineId: { type: Sequelize.UUID, allowNull: false, references: { model: "reels", key: "id" }, onDelete: "CASCADE" },
        userId: { type: Sequelize.STRING, allowNull: false }, idempotencyKey: { type: Sequelize.STRING, allowNull: false },
        version: { type: Sequelize.INTEGER, allowNull: false }, status: { type: Sequelize.STRING, allowNull: false },
        leaseOwner: { type: Sequelize.STRING, allowNull: false }, leaseExpiresAt: { type: Sequelize.DATE, allowNull: false },
        url: { type: Sequelize.STRING, allowNull: true }, error: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, transaction);
      await addIndexIfMissing(queryInterface, "thumbnail_generation_requests", ["pipelineId", "idempotencyKey"], { name: "thumbnail_generation_pipeline_key_unique", unique: true, transaction });
      await addIndexIfMissing(queryInterface, "thumbnail_generation_requests", ["pipelineId", "version"], { name: "thumbnail_generation_pipeline_version_unique", unique: true, transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("thumbnail_generation_requests", { transaction });
      await queryInterface.dropTable("script_revision_requests", { transaction });
      await queryInterface.dropTable("channel_styles", { transaction });
      for (const column of ["autoPublishRequested", "nextThumbnailVersion", "selectedThumbnailVersion", "thumbnailVersions", "channelStyle", "captionPreset", "approvedScriptFingerprint", "scriptApprovedAt", "scriptRevisionCount", "scriptVersion"]) {
        await queryInterface.removeColumn("reels", column, { transaction });
      }
    });
  },
};
