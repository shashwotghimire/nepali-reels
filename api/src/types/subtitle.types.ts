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

export type CaptionFrame = { pngPath: string; startSec: number; endSec: number };
