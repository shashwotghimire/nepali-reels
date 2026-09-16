import { Canvas, CanvasRenderingContext2D } from "skia-canvas";
import { writeFile, unlink } from "fs/promises";
import path from "path";
import type { Caption, CaptionFrame } from "../types/subtitle.types";
import {
  VIDEO_W,
  VIDEO_H,
  SUBTITLE_FONT,
  SUBTITLE_MAX_LINE_W,
  SUBTITLE_LINE_HEIGHT,
  SUBTITLE_BOTTOM_MARGIN,
  SUBTITLE_OUTLINE_WIDTH,
  SUBTITLE_TEXT_COLOR,
  SUBTITLE_OUTLINE_COLOR,
} from "../constants/constant";

function wrapLines(ctx: CanvasRenderingContext2D, text: string): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > SUBTITLE_MAX_LINE_W && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export type { CaptionFrame };

export async function renderCaptionFrames(
  scaledCaptions: Caption[],
  outputDir: string,
): Promise<CaptionFrame[]> {
  const results: CaptionFrame[] = [];

  for (let i = 0; i < scaledCaptions.length; i++) {
    const cap = scaledCaptions[i]!;
    const canvas = new Canvas(VIDEO_W, VIDEO_H);
    const ctx = canvas.getContext("2d");

    ctx.font = SUBTITLE_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const lines = wrapLines(ctx, cap.text);
    const totalH = lines.length * SUBTITLE_LINE_HEIGHT;
    const startY = VIDEO_H - SUBTITLE_BOTTOM_MARGIN - totalH + SUBTITLE_LINE_HEIGHT;

    for (let l = 0; l < lines.length; l++) {
      const x = VIDEO_W / 2;
      const y = startY + l * SUBTITLE_LINE_HEIGHT;

      ctx.lineWidth = SUBTITLE_OUTLINE_WIDTH;
      ctx.strokeStyle = SUBTITLE_OUTLINE_COLOR;
      ctx.lineJoin = "round";
      ctx.strokeText(lines[l]!, x, y);

      ctx.fillStyle = SUBTITLE_TEXT_COLOR;
      ctx.fillText(lines[l]!, x, y);
    }

    const pngPath = path.join(outputDir, `caption-${i}.png`);
    await writeFile(pngPath, await canvas.toBuffer("png"));
    results.push({ pngPath, startSec: cap.startSec, endSec: cap.endSec });
  }

  return results;
}

/** Render timed emphasis text near the top, independently of narration captions. */
export async function renderOverlayFrames(
  overlays: Caption[],
  outputDir: string,
): Promise<CaptionFrame[]> {
  const results: CaptionFrame[] = [];

  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i]!;
    const canvas = new Canvas(VIDEO_W, VIDEO_H);
    const ctx = canvas.getContext("2d");
    ctx.font = "bold 58px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lines = wrapLines(ctx, overlay.text);
    const boxHeight = Math.max(150, lines.length * 72 + 44);
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(48, 92, VIDEO_W - 96, boxHeight);
    for (let line = 0; line < lines.length; line++) {
      const y = 92 + 22 + 36 + line * 72;
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(lines[line]!, VIDEO_W / 2, y);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(lines[line]!, VIDEO_W / 2, y);
    }

    const pngPath = path.join(outputDir, `overlay-${i}.png`);
    await writeFile(pngPath, await canvas.toBuffer("png"));
    results.push({ pngPath, startSec: overlay.startSec, endSec: overlay.endSec });
  }

  return results;
}

export async function cleanupCaptionFrames(frames: CaptionFrame[]): Promise<void> {
  await Promise.all(frames.map((f) => unlink(f.pngPath).catch(() => {})));
}
