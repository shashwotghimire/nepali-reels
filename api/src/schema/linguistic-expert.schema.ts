import { z } from "zod";
import { ScriptOutputSchema } from "./script-writer.schema";

export const LinguisticExpertOutputSchema = z.object({
  verdict: z.enum(["pass", "revise"]),
  issues: z.array(
    z.object({
      type: z.enum([
        "unnatural_phrasing",
        "grammar_error",
        "register_mismatch",
        "awkward_idiom",
        "transliteration_creep",
      ]),
      excerpt: z.string(),
      note: z.string(),
    }),
  ),
  revisedScript: ScriptOutputSchema.nullable(),
});

export type LinguisticExpertOutput = z.infer<typeof LinguisticExpertOutputSchema>;
