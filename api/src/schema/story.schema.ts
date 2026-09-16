import { z } from "zod";

const TimedCaptionSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  text: z.string().min(1),
});

const StoryShotSchema = z.object({
  index: z.number().int().positive(),
  durationSec: z.number().min(4).max(12),
  beat: z.enum(["hook", "setup", "turn", "climax", "resolution"]),
  narrationNp: z.string().min(1),
  visual: z.string().min(1),
  cameraOrMotion: z.string().min(1),
  characterIds: z.array(z.string().min(1)),
  locationId: z.string().min(1),
  continuityNote: z.string().min(1),
});

export const StoryInputSchema = z.object({
  treatment: z.enum(["factual", "fictional"]),
});

export const StoryScriptOutputSchema = z.object({
  treatment: z.enum(["factual", "fictional"]),
  disclosureNp: z.string().min(1),
  factualClaims: z.array(z.object({
    claim: z.string().min(1),
    sourceBasis: z.string().min(1),
  })),
  characters: z.array(z.object({
    id: z.string().min(1),
    nameNp: z.string().min(1),
    stableDescription: z.string().min(1),
  })).min(1),
  locations: z.array(z.object({
    id: z.string().min(1),
    stableDescription: z.string().min(1),
  })).min(1),
  hookOptions: z.array(z.object({ text: z.string().min(1), style: z.enum(["question", "tension", "surprise"]) })).length(3),
  selectedHook: z.string().min(1),
  narrationNp: z.string().min(1),
  shotPlan: z.array(StoryShotSchema).min(3),
  captions: z.array(TimedCaptionSchema).min(3),
  titleOptions: z.array(z.string().min(1)).min(2).max(4),
  hashtags: z.array(z.string().min(1)).min(3).max(10),
  platformDescription: z.string().min(1),
  estDurationSec: z.number().min(12).max(75),
});

export const StorySceneSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  beat: z.enum(["hook", "setup", "turn", "climax", "resolution"]),
  bgPrompt: z.string().min(1),
  captionText: z.string().min(1),
  onScreenText: z.string().optional(),
  characterIds: z.array(z.string().min(1)),
  locationId: z.string().min(1),
  continuityFromPrevious: z.string().min(1),
});

export const StoryVideoSpecSchema = z.object({
  treatment: z.enum(["factual", "fictional"]),
  voiceoverText: z.string().min(1),
  characterBible: z.array(z.object({ id: z.string().min(1), stableDescription: z.string().min(1) })).min(1),
  locationBible: z.array(z.object({ id: z.string().min(1), stableDescription: z.string().min(1) })).min(1),
  scenes: z.array(StorySceneSchema).min(3),
  musicDirection: z.string().min(1),
  thumbnailText: z.string().min(1),
});

const StoryReviewIssueSchema = z.object({
  category: z.enum(["continuity", "unsupported_fact", "fiction_presented_as_fact", "missing_disclosure", "pacing", "unsafe_content"]),
  excerpt: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  note: z.string().min(1),
  needsSource: z.boolean(),
});

export const StoryReviewOutputSchema = z.object({
  verdict: z.enum(["pass", "revise", "unsafe"]),
  issues: z.array(StoryReviewIssueSchema),
  revisedScript: StoryScriptOutputSchema.nullable(),
});

export type StoryInput = z.infer<typeof StoryInputSchema>;
export type StoryScriptOutput = z.infer<typeof StoryScriptOutputSchema>;
export type StoryVideoSpec = z.infer<typeof StoryVideoSpecSchema>;
export type StoryReviewOutput = z.infer<typeof StoryReviewOutputSchema>;
