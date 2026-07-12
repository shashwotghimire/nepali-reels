'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tiktok_connection', 'tiktokRefreshExpiresAt', {
      type: Sequelize.BIGINT,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.changeColumn('tiktok_connection', 'tiktokExpiresAt', {
      type: Sequelize.BIGINT,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tiktok_connection', 'tiktokRefreshExpiresAt');
    await queryInterface.changeColumn('tiktok_connection', 'tiktokExpiresAt', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
