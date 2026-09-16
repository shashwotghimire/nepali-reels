'use strict';

/** Persist the discriminated input that selects and configures Phase 3 workflows. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reels', 'contentInput', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: { videoType: 'explainer' },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reels', 'contentInput');
  },
};
