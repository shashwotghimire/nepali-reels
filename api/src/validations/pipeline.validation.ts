import z from "zod";

export const getPipelineByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid pipeline ID"),
  }),
});

export const getReelsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().optional(),
  }),
});

export const generateScriptSchema = z.object({
  body: z.object({
    topic: z.string().min(3, "Topic must be at least 3 characters"),
  }),
});
