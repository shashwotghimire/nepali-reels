import { ALIGNMENT_WORDS_PER_LINE, ALIGNMENT_MAX_LINE_SECONDS } from "../constants/constant";

export interface Caption {
  startSec: number;
  endSec: number;
  text: string;
}

export interface AlignmentWord {
  text: string;
  start: number;
  end: number;
}

export function buildCaptionsFromAlignment(words: AlignmentWord[]): Caption[] {
  const filtered = words.filter((w) => w.text.trim());
  const captions: Caption[] = [];
  let chunk: AlignmentWord[] = [];
  let chunkStart: number | null = null;

  for (const w of filtered) {
    if (chunkStart === null) chunkStart = w.start;
    chunk.push(w);

    if (chunk.length >= ALIGNMENT_WORDS_PER_LINE || w.end - chunkStart >= ALIGNMENT_MAX_LINE_SECONDS) {
      captions.push({
        startSec: chunkStart,
        endSec: w.end,
        text: chunk.map((c) => c.text).join(" "),
      });
      chunk = [];
      chunkStart = null;
    }
  }

  if (chunk.length > 0 && chunkStart !== null) {
    captions.push({
      startSec: chunkStart,
      endSec: chunk[chunk.length - 1]!.end,
      text: chunk.map((c) => c.text).join(" "),
    });
  }

  return captions;
}
