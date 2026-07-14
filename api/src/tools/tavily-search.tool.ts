export const tavliySearchTool = {
  name: "tavily_search",
  description:
    "Search the web to verify factual claims — numbers, dates, statistics, named studies. Use for specific verifiable facts, not general knowledge.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "The search query" },
    },
    required: ["query"],
  },
};
