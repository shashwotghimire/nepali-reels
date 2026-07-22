'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('analytics_reports', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      reelId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'reels', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tiktokVideoId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      rawData: {
        type: Sequelize.JSONB,
        allowNull: false,
      },
      engagementRate: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      fetchedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('analytics_reports');
  },
};
