import { Scene } from "../schema/video-spec.schema";

function toSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function generateSrt(scenes: Scene[], actualDuration: number): string {
  const specDuration = scenes[scenes.length - 1].endSec;
  const scale = actualDuration / specDuration;

  return scenes
    .map((scene, i) => {
      const start = toSrtTimestamp(scene.startSec * scale);
      const end = toSrtTimestamp(scene.endSec * scale);
      return `${i + 1}\n${start} --> ${end}\n${scene.captionText}`;
    })
    .join("\n\n");
}
