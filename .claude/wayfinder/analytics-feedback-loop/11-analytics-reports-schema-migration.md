---
type: wayfinder:task
status: closed
blocked-by: [04]
blocks: [08]
---

## Question

Write and run a Sequelize migration that replaces the existing `analytics_reports` table with the user-level schema decided in ticket 04.

## Work to do

The current table (migration `20260722000000-analytics-reports.js` + `20260722000001-analytics-reports-add-report-suggestions.js`) has per-reel columns that are now wrong. Replace with:

```js
// api/migrations/20260723000000-analytics-reports-user-level.js
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('analytics_reports');
    await queryInterface.createTable('analytics_reports', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      rawData: { type: Sequelize.JSONB, allowNull: false },
      report: { type: Sequelize.JSONB, allowNull: true },
      suggestions: { type: Sequelize.JSONB, allowNull: true },
      fetchedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('analytics_reports', ['userId']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('analytics_reports');
    // Recreate old schema omitted — irreversible data change
  },
};
```

Update `api/src/models/analytics.model.ts` to match: replace `reelId`/`tiktokVideoId`/`engagementRate` with `userId`, change `rawData` type to `TikTokVideoInsight[]`.

Run `npx sequelize-cli db:migrate` and verify.

## Resolution

Migration `20260723000000-analytics-reports-user-level.js` and `analytics.model.ts` already exist with the correct user-level schema. Users table is `"user"` (better-auth convention), which the migration correctly references. No further work needed.
