'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reels', 'tiktokSubmissionState', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('reels', 'tiktokSubmissionAttemptId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reels', 'tiktokSubmissionAttemptId');
    await queryInterface.removeColumn('reels', 'tiktokSubmissionState');
  },
};
