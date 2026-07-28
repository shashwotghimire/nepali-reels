import fs from "fs";
import { elevenLabsClient } from "../../../configs/elevenlabs.config";
import { buildCaptionsFromAlignment } from "../../../helpers/srt.helper";
import type { Caption } from "../../../helpers/srt.helper";

export const forcedAlignmentAgent = async (
  audioFilePath: string,
  voiceoverText: string,
): Promise<Caption[]> => {
  const result = await elevenLabsClient.forcedAlignment.create({
    file: fs.createReadStream(audioFilePath),
    text: voiceoverText,
  });

  return buildCaptionsFromAlignment(result.words ?? []);
};
