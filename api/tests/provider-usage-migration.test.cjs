const assert = require('node:assert/strict');
const test = require('node:test');
const { Sequelize } = require('sequelize');
const migration = require('../migrations/20260914000000-provider-usage');

test('migration defines linked attempts and a cost-knownness check', async () => {
  let columns;
  const constraints = [];
  const queryInterface = {
    createTable: async (table, definition) => {
      assert.equal(table, 'provider_usage');
      columns = definition;
    },
    addIndex: async () => {},
    addConstraint: async (_table, options) => constraints.push(options),
  };
  await migration.up(queryInterface, Sequelize);

  assert.equal(columns.attemptId.primaryKey, true);
  assert.deepEqual(columns.userId.references, { model: 'user', key: 'id' });
  assert.equal(columns.pipelineId.allowNull, false);
  assert.equal(columns.pipelineId.references, undefined, 'deleting a reel must not erase incurred usage');
  assert.equal(columns.pipelineId.onDelete, undefined);
  assert.deepEqual(columns.retryOfAttemptId.references, {
    model: 'provider_usage', key: 'attemptId',
  });
  assert.equal(columns.costUsd.allowNull, true);
  assert.equal(columns.currency.defaultValue, 'USD');

  const sequelize = new Sequelize('postgres://u:p@localhost/d', {
    dialect: 'postgres', logging: false,
  });
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;
  const costCheck = constraints.find((item) => item.name === 'provider_usage_cost_knownness');
  const sql = queryGenerator.addConstraintQuery('provider_usage', costCheck);
  assert.match(sql, /"costProvenance" = 'unknown' AND "costUsd" IS NULL/);
  assert.match(sql, /"costProvenance" <> 'unknown' AND "costUsd" IS NOT NULL/);
  await sequelize.close();
});
