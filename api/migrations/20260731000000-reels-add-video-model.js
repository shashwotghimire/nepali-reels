'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reels', 'videoModel', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'bytedance/seedance-1-5-pro',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reels', 'videoModel');
  },
};
