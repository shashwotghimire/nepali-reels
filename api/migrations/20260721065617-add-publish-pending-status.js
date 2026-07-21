'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_reels_pipelineStatus" ADD VALUE IF NOT EXISTS 'publish_pending' BEFORE 'published';`
    );
  },

  async down (queryInterface, Sequelize) {
    // Postgres does not support removing ENUM values; no-op
  }
};
