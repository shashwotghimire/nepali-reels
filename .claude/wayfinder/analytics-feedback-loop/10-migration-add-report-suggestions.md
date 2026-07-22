---
type: wayfinder:task
status: closed
blocked-by: []
blocks: [04, 05]
---

## Question

Write and run a Sequelize migration that adds `report` (JSONB, nullable) and `suggestions` (JSONB, nullable) columns to the `analytics_reports` table.

## Work to do

Create `api/migrations/20260722000001-analytics-reports-add-report-suggestions.js`:

```js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('analytics_reports', 'report', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await queryInterface.addColumn('analytics_reports', 'suggestions', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('analytics_reports', 'report');
    await queryInterface.removeColumn('analytics_reports', 'suggestions');
  },
};
```

Then run `npx sequelize-cli db:migrate` and verify the columns exist.

## Resolution

Migration `20260722000001-analytics-reports-add-report-suggestions.js` exists. `Analytics` Sequelize model (`api/src/models/analytics.model.ts`) already declares `report: CreationOptional<object | null>` and `suggestions: CreationOptional<object | null>` as JSONB. `TikTokVideoInsight` interface also defined on the model, matching the CSV fixture schema from ticket 01. No further work needed.
