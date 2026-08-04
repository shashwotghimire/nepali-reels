import { z } from "zod";

export const SceneSchema = z
  .object({
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    bgPrompt: z.string(),
    captionText: z.string(),
    onScreenText: z.string().optional(),
  })
  .refine((s) => s.endSec - s.startSec >= 4, {
    message: "Scene duration must be at least 4 seconds",
  })
  .refine((s) => s.endSec - s.startSec <= 12, {
    message: "Scene duration must not exceed 12 seconds",
  });

export const VideoSpecSchema = z.object({
  voiceoverText: z.string(),
  scenes: z.array(SceneSchema).min(3),
  musicDirection: z.string(),
  thumbnailText: z.string(),
});

export type Scene = z.infer<typeof SceneSchema>;
export type VideoSpec = z.infer<typeof VideoSpecSchema>;
