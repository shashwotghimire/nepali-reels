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

// Skewed view distribution: most videos get low views, occasional spikes.
// Buckets: 60% low (200-3k), 25% mid (3k-30k), 12% good (30k-150k), 3% viral (150k-800k)
function realisticViews(): number {
  const r = Math.random();
  if (r < 0.60) return Math.floor(200 + Math.random() * 2800);
  if (r < 0.85) return Math.floor(3000 + Math.random() * 27000);
  if (r < 0.97) return Math.floor(30000 + Math.random() * 120000);
  return Math.floor(150000 + Math.random() * 650000);
}

async function main() {
  await sequelize.authenticate();

  const rows = await sequelize.query<{
    id: string;
    tiktokPublishId: string | null;
    topic: string;
    videoDurationSec: number | null;
    createdAt: string;
  }>(
    `SELECT id, "tiktokPublishId", topic, "videoDurationSec", "createdAt" FROM reels WHERE "userId" = :userId ORDER BY "createdAt" DESC`,
    { replacements: { userId: USER_ID }, type: "SELECT" as any },
  );

  if (!rows.length) {
    console.error("No reels found for user", USER_ID);
    process.exit(1);
  }

  const lines = ["id,create_time,video_description,duration,view_count,like_count,comment_count,share_count"];

  rows.forEach((row) => {
    const videoId = row.tiktokPublishId ?? row.id;
    const createTime = Math.floor(new Date(row.createdAt).getTime() / 1000);
    const duration = row.videoDurationSec != null ? Math.round(row.videoDurationSec) : 55;
    const views = realisticViews();
    // Engagement rates typical for small Nepali-language creator accounts:
    // likes 3-8%, comments 0.1-0.5%, shares 0.2-1%
    const likeRate = 0.03 + Math.random() * 0.05;
    const commentRate = 0.001 + Math.random() * 0.004;
    const shareRate = 0.002 + Math.random() * 0.008;
    const likes = Math.floor(views * likeRate);
    const comments = Math.floor(views * commentRate);
    const shares = Math.floor(views * shareRate);
    const description = row.topic.replace(/,/g, " ");
    lines.push(`${videoId},${createTime},${description},${duration},${views},${likes},${comments},${shares}`);
  });

  const outPath = path.resolve(__dirname, "../../samples/tiktok-metrics.csv");
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`Written ${rows.length} rows to ${outPath}`);

  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
