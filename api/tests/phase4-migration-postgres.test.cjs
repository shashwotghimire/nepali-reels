const test = require("node:test");
const assert = require("node:assert/strict");
const { Sequelize, DataTypes } = require("sequelize");
const fs = require("node:fs");
const path = require("node:path");
const migration = require("../migrations/20260916000002-phase4-creation-features.js");

const url = process.env.PHASE4_TEST_DATABASE_URL;

test("Phase 4 migration runs and reruns against disposable PostgreSQL pre-Phase4 schema", { skip: !url }, async () => {
  const sequelize = new Sequelize(url, { logging: false });
  const q = sequelize.getQueryInterface();
  try {
    await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await sequelize.query('CREATE TABLE "user" (id varchar(255) PRIMARY KEY)');
    const migrationDir = path.resolve(__dirname, "../migrations");
    const previous = fs.readdirSync(migrationDir).filter((name) => name.endsWith(".js") && name < "20260916000002-phase4-creation-features.js").sort();
    for (const name of previous) await require(path.join(migrationDir, name)).up(q, Sequelize);

    // Simulate one column left by an interrupted early implementation.
    await q.addColumn("reels", "scriptVersion", { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 });
    await sequelize.query(`CREATE TABLE script_revision_requests (id uuid PRIMARY KEY, "pipelineId" uuid NOT NULL REFERENCES reels(id), "userId" varchar(255) NOT NULL, "idempotencyKey" varchar(255) NOT NULL, "scriptVersion" integer NOT NULL, status varchar(255) NOT NULL, result jsonb, "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL)`);
    await migration.up(q, Sequelize);
    await migration.up(q, Sequelize);

    const columns = await q.describeTable("reels");
    assert.ok(columns.autoPublishRequested);
    assert.ok(columns.nextThumbnailVersion);
    const revisionColumns = await q.describeTable("script_revision_requests");
    assert.ok(revisionColumns.instruction);
    const [fk] = await sequelize.query(`SELECT ccu.table_name AS target FROM information_schema.table_constraints tc JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name WHERE tc.table_name='channel_styles' AND tc.constraint_type='FOREIGN KEY'`);
    assert.deepEqual(fk.map((row) => row.target), ["user"]);
    const [tables] = await sequelize.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`);
    assert.ok(tables.some((row) => row.tablename === "script_revision_requests"));
    assert.ok(tables.some((row) => row.tablename === "thumbnail_generation_requests"));
  } finally { await sequelize.close(); }
});
