import { toJSONSchema } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources";
import { FactCheckOutputSchema } from "../schema/fact-checker.schema";

export const submitResearchTool = {
  name: "submit_review",
  description:
    "Submit your final review verdict. Call this exactly once, as your last action, after any searches you needed.",
  input_schema: toJSONSchema(FactCheckOutputSchema) as Tool["input_schema"],
};
