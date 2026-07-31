import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const client = new AnthropicBedrock({
  awsAccessKey: process.env.BEDROCK_ACCESS_KEY_ID!,
  awsSecretKey: process.env.BEDROCK_SECRET_ACCESS_KEY!,
  awsRegion: process.env.BEDROCK_REGION!,
});

export default client;

export const gClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});
