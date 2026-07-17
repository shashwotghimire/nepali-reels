"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_reels_pipelineStatus" ADD VALUE IF NOT EXISTS 'video_generated' BEFORE 'failed';`
    );
  },

  async down() {
    // Postgres does not support removing enum values
  },
};
