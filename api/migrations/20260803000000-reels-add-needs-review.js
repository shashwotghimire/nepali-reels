"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_reels_pipelineStatus" ADD VALUE IF NOT EXISTS 'needs_review'`
    );
    await queryInterface.addColumn("reels", "reviewIssues", {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("reels", "reviewIssues");
    // Postgres does not support removing enum values; left as-is on rollback.
  },
};
