import { z } from "zod";
import { ScriptOutputSchema } from "./script-writer.schema";

export const FactCheckOutputSchema = z.object({
  verdict: z.enum(["pass", "revise", "needs_human", "unsafe"]),
  issues: z.array(
    z.object({
      category: z.enum([
        "factual_uncertainty",
        "needs_source",
        "misleading_simplification",
        "unsafe_content",
        "policy_risk",
      ]),
      excerpt: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      note: z.string(),
      needsSource: z.boolean(),
    }),
  ),
  revisedScript: ScriptOutputSchema.nullable(), // present only when verdict === "revise"
});

export type FactCheckOutput = z.infer<typeof FactCheckOutputSchema>;
