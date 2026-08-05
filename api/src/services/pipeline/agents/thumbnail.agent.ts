import client from "../../../configs/llm.config";
import { openRouterClient } from "../../../configs/openrouter.config";
import { THUMBNAIL_AGENT_SYSTEM_PROMPT } from "../../../llm/thumbnail.prompt";
import type { VideoSpec } from "../../../schema/video-spec.schema";
import type { AgentResult } from "../../../types/usage.types";

export const generateThumbnailAgent = async (
  videoSpec: VideoSpec,
  model: string,
): Promise<AgentResult<Buffer>> => {
  const promptResponse = await client.messages.create({
    model,
    max_tokens: 512,
    system: THUMBNAIL_AGENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate a thumbnail prompt for this video.\n\nThumbnail text: ${videoSpec.thumbnailText}\n\nScript summary:\n${videoSpec.scenes.map((s) => s.captionText).join(" ")}`,
      },
    ],
  });

  const imagePrompt = promptResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!imagePrompt) throw new Error("Thumbnail prompt generation failed");

  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?seed=${seed}&width=720&height=1280&nologo=true`;
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Pollinations request failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return {
    data: Buffer.from(arrayBuffer),
    usage: {
      inputTokens: promptResponse.usage.input_tokens,
      outputTokens: promptResponse.usage.output_tokens,
      cacheWriteTokens: promptResponse.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: promptResponse.usage.cache_read_input_tokens ?? 0,
    },
  };
};

export const generateThumbnailOpenRouter = async (
  videoSpec: VideoSpec,
  model: string,
  imageModel: string,
): Promise<AgentResult<Buffer>> => {
  const promptResponse = await client.messages.create({
    model,
    max_tokens: 512,
    system: THUMBNAIL_AGENT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate a thumbnail prompt for this video.\n\nThumbnail text: ${videoSpec.thumbnailText}\n\nScript summary:\n${videoSpec.scenes.map((s) => s.captionText).join(" ")}`,
      },
    ],
  });

  const imagePrompt = promptResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!imagePrompt) throw new Error("Thumbnail prompt generation failed");

  const result = await openRouterClient.images.generate({
    imageGenerationRequest: {
      model: imageModel,
      prompt: imagePrompt,
      aspectRatio: "9:16",
      outputFormat: "jpeg",
    },
  });

  const b64 = (result as { data: { b64Json: string }[] }).data[0]?.b64Json;
  if (!b64)
    throw new Error("[thumbnail] OpenRouter image generation returned no data");

  return {
    data: Buffer.from(b64, "base64"),
    usage: {
      inputTokens: promptResponse.usage.input_tokens,
      outputTokens: promptResponse.usage.output_tokens,
      cacheWriteTokens: promptResponse.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: promptResponse.usage.cache_read_input_tokens ?? 0,
    },
  };
};
