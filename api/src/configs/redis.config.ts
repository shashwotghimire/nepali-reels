import "dotenv/config";
import Redis from "ioredis";

export const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
};

const redis = new Redis(connection);
export default redis;
