'use strict';

/** Existing costUsd values predate attempt metering and are incomplete. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reels', 'legacyCostUsd', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.sequelize.query('UPDATE reels SET "legacyCostUsd" = "costUsd" WHERE "costUsd" IS NOT NULL');
    await queryInterface.addColumn('reels', 'costEstimateIncomplete', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('reels', 'costEstimateIncomplete');
    await queryInterface.removeColumn('reels', 'legacyCostUsd');
  },
};
