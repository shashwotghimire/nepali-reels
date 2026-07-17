'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reels', 'claudeModel', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reels', 'claudeModel');
  },
};
