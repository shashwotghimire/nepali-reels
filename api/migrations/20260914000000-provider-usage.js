'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('provider_usage', {
      attemptId: {
        type: Sequelize.UUID,
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
      pipelineId: {
        type: Sequelize.UUID,
        allowNull: false,
        // Retain the immutable pipeline identifier after a user deletes a reel.
        // Provider costs are accounting records, not dependent media rows.
      },
      retryOfAttemptId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'provider_usage', key: 'attemptId' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      operation: { type: Sequelize.STRING, allowNull: false },
      stage: { type: Sequelize.STRING, allowNull: false },
      provider: { type: Sequelize.STRING, allowNull: false },
      model: { type: Sequelize.STRING, allowNull: true },
      configuration: { type: Sequelize.JSONB, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed', 'retried'),
        allowNull: false,
        defaultValue: 'pending',
      },
      inputTokens: { type: Sequelize.INTEGER, allowNull: true },
      outputTokens: { type: Sequelize.INTEGER, allowNull: true },
      cacheWriteTokens: { type: Sequelize.INTEGER, allowNull: true },
      cacheReadTokens: { type: Sequelize.INTEGER, allowNull: true },
      audioInputSeconds: { type: Sequelize.DECIMAL(14, 3), allowNull: true },
      audioOutputSeconds: { type: Sequelize.DECIMAL(14, 3), allowNull: true },
      audioCharacters: { type: Sequelize.INTEGER, allowNull: true },
      generatedVideoSeconds: { type: Sequelize.DECIMAL(14, 3), allowNull: true },
      imageCount: { type: Sequelize.INTEGER, allowNull: true },
      imageUsage: { type: Sequelize.JSONB, allowNull: true },
      costUsd: { type: Sequelize.DECIMAL(18, 8), allowNull: true },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'USD',
      },
      costProvenance: {
        type: Sequelize.ENUM('actual', 'estimated', 'unknown'),
        allowNull: false,
        defaultValue: 'unknown',
      },
      rateVersion: { type: Sequelize.STRING, allowNull: true },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('provider_usage', ['pipelineId', 'createdAt']);
    await queryInterface.addIndex('provider_usage', ['userId', 'createdAt']);
    await queryInterface.addConstraint('provider_usage', {
      fields: ['currency'],
      type: 'check',
      name: 'provider_usage_currency_usd',
      where: { currency: 'USD' },
    });
    await queryInterface.addConstraint('provider_usage', {
      fields: ['costUsd', 'costProvenance'],
      type: 'check',
      name: 'provider_usage_cost_knownness',
      where: Sequelize.literal(
        '("costProvenance" = \'unknown\' AND "costUsd" IS NULL) OR ' +
        '("costProvenance" <> \'unknown\' AND "costUsd" IS NOT NULL AND "costUsd" >= 0)',
      ),
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('provider_usage');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_provider_usage_status";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_provider_usage_costProvenance";',
    );
  },
};
