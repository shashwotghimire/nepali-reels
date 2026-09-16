"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query("ALTER TYPE enum_reels_pipelineStatus ADD VALUE IF NOT EXISTS 'awaiting_script_approval'");
    await queryInterface.addColumn("reels", "scriptVersion", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
    await queryInterface.addColumn("reels", "scriptRevisionCount", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await queryInterface.addColumn("reels", "scriptApprovedAt", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("reels", "approvedScriptFingerprint", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn("reels", "captionPreset", { type: Sequelize.STRING, allowNull: false, defaultValue: "default" });
    await queryInterface.addColumn("reels", "channelStyle", { type: Sequelize.JSONB, allowNull: true });
    await queryInterface.addColumn("reels", "thumbnailVersions", { type: Sequelize.JSONB, allowNull: true });
    await queryInterface.addColumn("reels", "selectedThumbnailVersion", { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.createTable("channel_styles", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      userId: { type: Sequelize.STRING, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      name: { type: Sequelize.STRING, allowNull: false },
      channelName: { type: Sequelize.STRING, allowNull: false },
      logoUrl: { type: Sequelize.STRING, allowNull: true },
      captionPreset: { type: Sequelize.STRING, allowNull: false, defaultValue: "default" },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("channel_styles", ["userId", "name"], { unique: true });
    await queryInterface.createTable("script_revision_requests", {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      pipelineId: { type: Sequelize.UUID, allowNull: false, references: { model: "reels", key: "id" }, onDelete: "CASCADE" },
      userId: { type: Sequelize.STRING, allowNull: false },
      idempotencyKey: { type: Sequelize.STRING, allowNull: false },
      scriptVersion: { type: Sequelize.INTEGER, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false },
      result: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("script_revision_requests", ["pipelineId", "idempotencyKey"], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("script_revision_requests");
    await queryInterface.dropTable("channel_styles");
    for (const column of ["selectedThumbnailVersion", "thumbnailVersions", "channelStyle", "captionPreset", "approvedScriptFingerprint", "scriptApprovedAt", "scriptRevisionCount", "scriptVersion"]) {
      await queryInterface.removeColumn("reels", column);
    }
  },
};
