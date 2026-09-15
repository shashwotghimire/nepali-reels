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
  // The trusted entitlement-specific range is enforced by the workflow. This
  // schema only enforces the physical range supported by three 4s shots.
  estDurationSec: z.number().min(12, "Script must be at least 12 seconds").max(75, "Script must not exceed 75 seconds"),
});

export type ScriptOutput = z.infer<typeof ScriptOutputSchema>;
