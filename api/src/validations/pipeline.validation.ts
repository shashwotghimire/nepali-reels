import z from "zod";

export const generateScriptSchema = z.object({
  body: z.object({
    topic: z.string().min(3, "Topic must be at least 3 characters"),
  }),
});
