import client from "../../../configs/llm.config";
import { THUMBNAIL_AGENT_SYSTEM_PROMPT } from "../../../llm/thumbnail.prompt";
import type { VideoSpec } from "../../../schema/video-spec.schema";

export const generateThumbnailAgent = async (
  videoSpec: VideoSpec,
  model: string,
): Promise<Buffer> => {
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
  if (!response.ok) throw new Error(`Pollinations request failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};
