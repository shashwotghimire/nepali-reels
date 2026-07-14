import { tavily } from "@tavily/core";
import "dotenv/config";

const tavilyClient = tavily({ apiKey: `${process.env.TAVILY_API_KEY}` });

export async function runTavilySearch(query: string) {
  const response = await tavilyClient.search(query, {
    searchDepth: "basic",
    maxResults: 5,
  });
  return response.results.map((result) => ({
    title: result.title,
    url: result.url,
    content: result.content,
    score: result.score,
  }));
}
