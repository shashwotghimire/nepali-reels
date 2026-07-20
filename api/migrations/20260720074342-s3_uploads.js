'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reels', 's3key', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('reels', 'tiktokPublishId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_reels_pipelineStatus" ADD VALUE IF NOT EXISTS 'published' BEFORE 'failed';`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('reels', 's3key');
    await queryInterface.removeColumn('reels', 'tiktokPublishId');
  },
};
