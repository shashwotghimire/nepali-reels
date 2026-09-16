import z from "zod";
import { CLAUDE_MODELS, VIDEO_MODELS } from "../constants/constant";
import { StoryInputSchema } from "../schema/story.schema";
import { ListInputSchema } from "../schema/list.schema";

const claudeModelValues = Object.values(CLAUDE_MODELS) as [string, ...string[]];
const videoModelValues = Object.values(VIDEO_MODELS) as [string, ...string[]];

export const TTS_VOICES = ["aoede", "fenrir", "puck", "zephyr", "kore", "charon", "callirrhoe"] as const;
export type TtsVoice = typeof TTS_VOICES[number];

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

const commonGenerationFields = {
  topic: z.string().trim().min(3, "Topic must be at least 3 characters"),
  model: z.enum(claudeModelValues).default(CLAUDE_MODELS["Sonnet 4.5"]),
  videoModel: z.enum(videoModelValues).default(VIDEO_MODELS["Seedance 1.5 Pro"]),
  ttsVoice: z.enum(TTS_VOICES).default("aoede"),
  autoPublish: z.boolean().default(false),
  captionPreset: z.enum(["default", "bold", "minimal"]).default("default"),
  styleId: z.string().uuid().optional(),
};

export const generateScriptBodySchema = z.union([
  z.object({
    ...commonGenerationFields,
    videoType: z.literal("explainer").default("explainer"),
  }).strict(),
  z.object({
    ...commonGenerationFields,
    videoType: z.literal("story"),
    storyInput: StoryInputSchema,
  }).strict(),
  z.object({
    ...commonGenerationFields,
    videoType: z.literal("list"),
    listInput: ListInputSchema,
  }).strict(),
]);

export const generateScriptSchema = z.object({ body: generateScriptBodySchema });

export const editScriptSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ expectedVersion: z.number().int().positive(), script: z.record(z.string(), z.unknown()) }).strict(),
});

export const reviseScriptSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ expectedVersion: z.number().int().positive(), instruction: z.string().trim().min(3).max(1000) }).strict(),
});

export const approveScriptSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ expectedVersion: z.number().int().positive() }).strict(),
});
