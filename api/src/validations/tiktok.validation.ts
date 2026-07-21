import z from "zod";

export const publishVideoSchema = z.object({
  body: z.object({
    pipelineId: z.string().uuid("Invalid pipeline ID"),
    videoUrl: z.string().url("Invalid video URL"),
    title: z.string().min(1, "Title is required").max(150, "Title must be 150 characters or less"),
  }),
});
