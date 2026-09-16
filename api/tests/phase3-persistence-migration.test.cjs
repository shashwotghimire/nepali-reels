const assert = require('node:assert/strict');
const test = require('node:test');
const migration = require('../migrations/20260916000001-reels-content-input.js');

test('Phase 3 migration persists a non-null Explainer-compatible content input', async () => {
  const calls = [];
  await migration.up({
    addColumn: async (table, column, definition) => calls.push({ table, column, definition }),
  }, { JSONB: 'JSONB' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, 'reels');
  assert.equal(calls[0].column, 'contentInput');
  assert.equal(calls[0].definition.allowNull, false);
  assert.deepEqual(calls[0].definition.defaultValue, { videoType: 'explainer' });
});
