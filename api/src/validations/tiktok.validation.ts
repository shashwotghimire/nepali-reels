import z from "zod";

export const publishVideoSchema = z.object({
  body: z
    .object({
      pipelineId: z.string().uuid("Invalid pipeline ID"),
      title: z.string().min(1, "Title is required").max(2200, "Title must be 2200 characters or less"),
      privacyLevel: z.string().min(1, "Privacy level is required"),
      disableComment: z.boolean(),
      disableDuet: z.boolean(),
      disableStitch: z.boolean(),
      brandContentToggle: z.boolean(),
      brandOrganicToggle: z.boolean(),
      isAigc: z.boolean(),
    })
    .refine(
      (data) => !(data.brandContentToggle && data.privacyLevel === "SELF_ONLY"),
      { message: "Branded content cannot be posted as private (SELF_ONLY).", path: ["privacyLevel"] },
    ),
});
