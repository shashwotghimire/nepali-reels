import { z } from "zod";

const ListOrderSchema = z.enum(["ascending", "descending"]);

export const ListInputSchema = z.object({
  itemCount: z.number().int().min(3).max(10),
  order: ListOrderSchema,
});

export const ListItemSchema = z.object({
  number: z.number().int().positive(),
  labelNp: z.string().min(1),
  narrationNp: z.string().min(1),
  takeawayNp: z.string().min(1),
  visual: z.string().min(1),
  sourceBasis: z.string().min(1),
  durationSec: z.number().min(4).max(12),
});

export const ListScriptOutputSchema = z.object({
  order: ListOrderSchema,
  itemCount: z.number().int().min(3).max(10),
  rankingBasis: z.string().min(1),
  hook: z.object({
    narrationNp: z.string().min(1),
    durationSec: z.number().min(4).max(12),
  }),
  items: z.array(ListItemSchema).min(3).max(10),
  closing: z.object({
    narrationNp: z.string().min(1),
    durationSec: z.number().min(4).max(12),
  }),
  narrationNp: z.string().min(1),
  captions: z.array(z.object({
    startSec: z.number().nonnegative(),
    endSec: z.number().positive(),
    text: z.string().min(1),
  })).min(3),
  titleOptions: z.array(z.string().min(1)).min(2).max(4),
  hashtags: z.array(z.string().min(1)).min(3).max(10),
  platformDescription: z.string().min(1),
  estDurationSec: z.number().min(20).max(75),
});

export const ListSceneSchema = z.object({
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  role: z.enum(["hook", "item", "closing"]),
  itemNumber: z.number().int().positive().nullable(),
  bgPrompt: z.string().min(1),
  captionText: z.string().min(1),
  onScreenText: z.string().optional(),
});

export const ListVideoSpecSchema = z.object({
  order: ListOrderSchema,
  voiceoverText: z.string().min(1),
  scenes: z.array(ListSceneSchema).min(5),
  musicDirection: z.string().min(1),
  thumbnailText: z.string().min(1),
});

export const ListReviewOutputSchema = z.object({
  verdict: z.enum(["pass", "revise", "unsafe"]),
  issues: z.array(z.object({
    category: z.enum(["numbering", "item_count", "ranking_basis", "unsupported_fact", "duplicate_item", "pacing", "unsafe_content"]),
    itemNumber: z.number().int().positive().nullable(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    note: z.string().min(1),
    needsSource: z.boolean(),
  })),
  revisedScript: ListScriptOutputSchema.nullable(),
});

export type ListInput = z.infer<typeof ListInputSchema>;
export type ListScriptOutput = z.infer<typeof ListScriptOutputSchema>;
export type ListVideoSpec = z.infer<typeof ListVideoSpecSchema>;
export type ListReviewOutput = z.infer<typeof ListReviewOutputSchema>;
