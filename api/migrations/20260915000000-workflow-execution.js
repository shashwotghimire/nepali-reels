'use strict';

/** Durable Phase 2 workflow state and conservative, concurrency-safe budget reservations. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reels', 'videoType', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'explainer',
    });
    await queryInterface.addColumn('reels', 'workflowVersion', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.createTable('workflow_stage_attempts', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      pipelineId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'reels', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      workflowVersion: { type: Sequelize.INTEGER, allowNull: false },
      stage: { type: Sequelize.STRING, allowNull: false },
      executionKey: { type: Sequelize.STRING, allowNull: false },
      status: {
        type: Sequelize.ENUM('running', 'succeeded', 'failed'),
        allowNull: false,
        defaultValue: 'running',
      },
      leaseOwner: { type: Sequelize.STRING, allowNull: true },
      leaseExpiresAt: { type: Sequelize.DATE, allowNull: true },
      providerAttemptId: { type: Sequelize.UUID, allowNull: true },
      input: { type: Sequelize.JSONB, allowNull: true },
      output: { type: Sequelize.JSONB, allowNull: true },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      startedAt: { type: Sequelize.DATE, allowNull: false },
      completedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('workflow_stage_attempts', {
      fields: ['pipelineId', 'workflowVersion', 'stage', 'executionKey'],
      type: 'unique',
      name: 'workflow_stage_attempts_execution_unique',
    });
    await queryInterface.addIndex('workflow_stage_attempts', ['pipelineId', 'createdAt']);
    await queryInterface.addIndex('workflow_stage_attempts', ['providerAttemptId'], { unique: true });

    await queryInterface.createTable('workflow_artifacts', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      pipelineId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'reels', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      stageAttemptId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'workflow_stage_attempts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      artifactKey: { type: Sequelize.STRING, allowNull: false },
      kind: { type: Sequelize.STRING, allowNull: false },
      storageProvider: { type: Sequelize.STRING, allowNull: false },
      storageKey: { type: Sequelize.TEXT, allowNull: false },
      contentType: { type: Sequelize.STRING, allowNull: true },
      byteSize: { type: Sequelize.BIGINT, allowNull: true },
      checksum: { type: Sequelize.STRING, allowNull: true },
      fingerprint: { type: Sequelize.STRING, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('workflow_artifacts', {
      fields: ['pipelineId', 'artifactKey'],
      type: 'unique',
      name: 'workflow_artifacts_pipeline_key_unique',
    });
    await queryInterface.addIndex('workflow_artifacts', ['pipelineId', 'kind']);
    await queryInterface.addIndex('workflow_artifacts', ['pipelineId', 'fingerprint']);

    await queryInterface.createTable('pipeline_budget_counters', {
      pipelineId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        references: { model: 'reels', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      reservedProviderCalls: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      consumedProviderCalls: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reservedInputTokens: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      consumedInputTokens: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      reservedOutputTokens: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      consumedOutputTokens: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      reservedSearches: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      consumedSearches: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      reservedGeneratedSeconds: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
      consumedGeneratedSeconds: { type: Sequelize.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
      reservedAiRevisions: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      consumedAiRevisions: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('pipeline_budget_reservations', {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      pipelineId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'reels', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: 'user', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      stageAttemptId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'workflow_stage_attempts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM('reserved', 'settled', 'released'),
        allowNull: false,
        defaultValue: 'reserved',
      },
      requestedProviderCalls: { type: Sequelize.INTEGER, allowNull: false },
      requestedInputTokens: { type: Sequelize.BIGINT, allowNull: false },
      requestedOutputTokens: { type: Sequelize.BIGINT, allowNull: false },
      requestedSearches: { type: Sequelize.INTEGER, allowNull: false },
      requestedGeneratedSeconds: { type: Sequelize.DECIMAL(14, 3), allowNull: false },
      requestedAiRevisions: { type: Sequelize.INTEGER, allowNull: false },
      actualProviderCalls: { type: Sequelize.INTEGER, allowNull: true },
      actualInputTokens: { type: Sequelize.BIGINT, allowNull: true },
      actualOutputTokens: { type: Sequelize.BIGINT, allowNull: true },
      actualSearches: { type: Sequelize.INTEGER, allowNull: true },
      actualGeneratedSeconds: { type: Sequelize.DECIMAL(14, 3), allowNull: true },
      actualAiRevisions: { type: Sequelize.INTEGER, allowNull: true },
      releaseReason: { type: Sequelize.TEXT, allowNull: true },
      settledAt: { type: Sequelize.DATE, allowNull: true },
      releasedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('pipeline_budget_reservations', ['pipelineId', 'status']);

    for (const table of ['pipeline_budget_counters', 'pipeline_budget_reservations']) {
      await queryInterface.addConstraint(table, {
        fields: table === 'pipeline_budget_counters'
          ? [
              'reservedProviderCalls', 'consumedProviderCalls',
              'reservedInputTokens', 'consumedInputTokens',
              'reservedOutputTokens', 'consumedOutputTokens',
              'reservedSearches', 'consumedSearches',
              'reservedGeneratedSeconds', 'consumedGeneratedSeconds',
              'reservedAiRevisions', 'consumedAiRevisions',
            ]
          : [
              'requestedProviderCalls', 'requestedInputTokens', 'requestedOutputTokens',
              'requestedSearches', 'requestedGeneratedSeconds', 'requestedAiRevisions',
              'actualProviderCalls', 'actualInputTokens', 'actualOutputTokens',
              'actualSearches', 'actualGeneratedSeconds', 'actualAiRevisions',
            ],
        type: 'check',
        name: `${table}_nonnegative_usage`,
        where: Sequelize.literal(
          table === 'pipeline_budget_counters'
            ? '"reservedProviderCalls" >= 0 AND "consumedProviderCalls" >= 0 AND "reservedInputTokens" >= 0 AND "consumedInputTokens" >= 0 AND "reservedOutputTokens" >= 0 AND "consumedOutputTokens" >= 0 AND "reservedSearches" >= 0 AND "consumedSearches" >= 0 AND "reservedGeneratedSeconds" >= 0 AND "consumedGeneratedSeconds" >= 0 AND "reservedAiRevisions" >= 0 AND "consumedAiRevisions" >= 0'
            : '"requestedProviderCalls" >= 0 AND "requestedInputTokens" >= 0 AND "requestedOutputTokens" >= 0 AND "requestedSearches" >= 0 AND "requestedGeneratedSeconds" >= 0 AND "requestedAiRevisions" >= 0 AND ("actualProviderCalls" IS NULL OR "actualProviderCalls" >= 0) AND ("actualInputTokens" IS NULL OR "actualInputTokens" >= 0) AND ("actualOutputTokens" IS NULL OR "actualOutputTokens" >= 0) AND ("actualSearches" IS NULL OR "actualSearches" >= 0) AND ("actualGeneratedSeconds" IS NULL OR "actualGeneratedSeconds" >= 0) AND ("actualAiRevisions" IS NULL OR "actualAiRevisions" >= 0)',
        ),
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pipeline_budget_reservations');
    await queryInterface.dropTable('pipeline_budget_counters');
    await queryInterface.dropTable('workflow_artifacts');
    await queryInterface.dropTable('workflow_stage_attempts');
    await queryInterface.removeColumn('reels', 'workflowVersion');
    await queryInterface.removeColumn('reels', 'videoType');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_pipeline_budget_reservations_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_workflow_stage_attempts_status";');
  },
};
