'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('analytics_reports', 'report', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await queryInterface.addColumn('analytics_reports', 'suggestions', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('analytics_reports', 'report');
    await queryInterface.removeColumn('analytics_reports', 'suggestions');
  },
};
