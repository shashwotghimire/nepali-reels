import "dotenv/config";
import fs from "fs";
import path from "path";
import { Sequelize } from "sequelize";

const sequelize = new Sequelize({
  dialect: "postgres",
  host: process.env.PGHOST!,
  database: process.env.PGDATABASE!,
  username: process.env.PGUSER!,
  password: process.env.PGPASSWORD!,
  dialectOptions: { ssl: { require: true } },
  logging: false,
});

const USER_ID = "Yedr8ZcyXjltytMb9J29S8exKxhd62ch";

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
  await sequelize.authenticate();

  const rows = await sequelize.query<{ id: string; tiktokPublishId: string | null; topic: string }>(
    `SELECT id, "tiktokPublishId", topic FROM reels WHERE "userId" = :userId ORDER BY "createdAt" DESC`,
    { replacements: { userId: USER_ID }, type: "SELECT" as any },
  );

  if (!rows.length) {
    console.error("No reels found for user", USER_ID);
    process.exit(1);
  }

  const lines = ["id,create_time,video_description,duration,view_count,like_count,comment_count,share_count"];
  const now = Math.floor(Date.now() / 1000);

  rows.forEach((row, i) => {
    const videoId = row.tiktokPublishId ?? row.id;
    const createTime = now - (rows.length - i) * 86400;
    const duration = randomBetween(45, 70);
    const views = randomBetween(5000, 120000);
    const likes = Math.floor(views * (randomBetween(5, 12) / 100));
    const comments = Math.floor(views * (randomBetween(3, 8) / 1000));
    const shares = Math.floor(views * (randomBetween(5, 20) / 1000));
    const description = row.topic.replace(/,/g, " ");
    lines.push(`${videoId},${createTime},${description},${duration},${views},${likes},${comments},${shares}`);
  });

  const outPath = path.resolve(__dirname, "../samples/tiktok-metrics.csv");
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`Written ${rows.length} rows to ${outPath}`);

  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
