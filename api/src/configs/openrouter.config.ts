import { OpenRouter } from "@openrouter/sdk";
import "dotenv/config";

export const openRouterClient = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});
