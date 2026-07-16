import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const client = new AnthropicBedrock();

export default client;

export const gClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});
