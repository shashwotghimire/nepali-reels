const assert = require('node:assert/strict');
const test = require('node:test');
const { Sequelize } = require('sequelize');
const migration = require('../migrations/20260915000000-workflow-execution');

test('Phase 2 migration backfills Explainer identity and creates durable execution tables', async () => {
  const addedColumns = [];
  const tables = new Map();
  const constraints = [];
  const indexes = [];
  const queryInterface = {
    addColumn: async (table, column, definition) => addedColumns.push({ table, column, definition }),
    createTable: async (table, definition) => tables.set(table, definition),
    addConstraint: async (table, options) => constraints.push({ table, options }),
    addIndex: async (table, fields, options) => indexes.push({ table, fields, options }),
  };

  await migration.up(queryInterface, Sequelize);

  const videoType = addedColumns.find((item) => item.column === 'videoType');
  const workflowVersion = addedColumns.find((item) => item.column === 'workflowVersion');
  assert.equal(videoType.table, 'reels');
  assert.equal(videoType.definition.allowNull, false);
  assert.equal(videoType.definition.defaultValue, 'explainer');
  assert.equal(workflowVersion.definition.defaultValue, 1);

  const attempts = tables.get('workflow_stage_attempts');
  assert.deepEqual(attempts.pipelineId.references, { model: 'reels', key: 'id' });
  assert.equal(attempts.pipelineId.onDelete, 'CASCADE');
  assert.equal(attempts.providerAttemptId.allowNull, true);
  assert.ok(constraints.some(({ options }) => options.name === 'workflow_stage_attempts_execution_unique'));
  assert.ok(indexes.some(({ table, fields, options }) =>
    table === 'workflow_stage_attempts' && fields[0] === 'providerAttemptId' && options.unique));

  const artifacts = tables.get('workflow_artifacts');
  assert.equal(artifacts.storageKey.allowNull, false);
  assert.equal(artifacts.fingerprint.allowNull, true);
  assert.ok(constraints.some(({ options }) => options.name === 'workflow_artifacts_pipeline_key_unique'));

  const counters = tables.get('pipeline_budget_counters');
  const reservations = tables.get('pipeline_budget_reservations');
  assert.equal(counters.pipelineId.primaryKey, true);
  assert.equal(reservations.id.type.toString(), Sequelize.STRING.toString());
  assert.equal(reservations.actualGeneratedSeconds.allowNull, true);
  assert.equal(reservations.requestedInputTokens.allowNull, false);
  assert.equal(reservations.requestedOutputTokens.allowNull, false);
});
