import { z } from "zod";

export const ScriptOutputSchema = z.object({
  hookOptions: z
    .array(
      z.object({
        text: z.string(),
        style: z.enum([
          "question",
          "shock",
          "curiosity_gap",
          "relatable",
          "bold_claim",
          "story",
        ]),
      }),
    )
    .length(3),
  selectedHook: z.string(),
  narrationNp: z.string(),
  shotPlan: z
    .array(
      z.object({
        index: z.number().int(),
        durationSec: z.number().min(4, "Shot duration must be at least 4 seconds").max(12, "Shot duration must not exceed 12 seconds"),
        visual: z.string(),
        cameraOrMotion: z.string(),
      }),
    )
    .min(3),
  onScreenText: z.array(z.object({ atSec: z.number(), text: z.string() })),
  captions: z
    .array(
      z.object({
        startSec: z.number(),
        endSec: z.number(),
        text: z.string(),
      }),
    )
    .min(3),
  titleOptions: z.array(z.string()).min(2),
  hashtags: z.array(z.string()).min(3),
  platformDescription: z.string(),
  estDurationSec: z.number().min(50, "Script must be at least 50 seconds").max(70, "Script must not exceed 70 seconds"),
});

export type ScriptOutput = z.infer<typeof ScriptOutputSchema>;
