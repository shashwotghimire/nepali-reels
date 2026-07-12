'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('tiktok_connection', {
      fields: ['userId'],
      type: 'unique',
      name: 'tiktok_connection_userId_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('tiktok_connection', 'tiktok_connection_userId_unique');
  },
};
