'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_reels_pipelineStatus" ADD VALUE IF NOT EXISTS 'linguistic_reviewed' BEFORE 'video_spec_generated';`
    );
  },

  async down() {
    // Postgres does not support removing ENUM values; no-op
  },
};
