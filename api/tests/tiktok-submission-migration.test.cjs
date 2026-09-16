const assert = require('node:assert/strict');
const test = require('node:test');
const { Sequelize } = require('sequelize');
const migration = require('../migrations/20260916000000-reels-tiktok-submission-state');

test('TikTok submission migration adds durable reel-level guard fields', async () => {
  const addedColumns = [];
  const queryInterface = {
    addColumn: async (table, column, definition) => addedColumns.push({ table, column, definition }),
  };

  await migration.up(queryInterface, Sequelize);

  const state = addedColumns.find((item) => item.column === 'tiktokSubmissionState');
  const attempt = addedColumns.find((item) => item.column === 'tiktokSubmissionAttemptId');
  assert.equal(state.table, 'reels');
  assert.equal(state.definition.allowNull, true);
  assert.equal(attempt.definition.type.toString(), Sequelize.UUID.toString());
  assert.equal(attempt.definition.allowNull, true);
});
