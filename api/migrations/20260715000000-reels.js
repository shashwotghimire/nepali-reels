'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reels', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      topic: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      draftScript: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      finalScript: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      videoSpec: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      soundSpec: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      pipelineStatus: {
        type: Sequelize.ENUM(
          'queued',
          'script_generated',
          'script_finalised',
          'video_spec_generated',
          'sound_generated',
          'failed',
        ),
        allowNull: false,
        defaultValue: 'queued',
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
    await queryInterface.dropTable('reels');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_reels_pipelineStatus";',
    );
  },
};
