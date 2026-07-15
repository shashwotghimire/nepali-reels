import {
  createPipeline,
  findPipelineById,
  saveDraftScript,
  saveFinalScript,
  saveVideoSpec,
} from "../../repositories/reels.repository";
import { ApiError } from "../../utils/ApiError.util";
import { factCheckerAgent } from "../pipeline/agents/fact-checker.agent";
import { scriptGeneratorAgent } from "../pipeline/agents/script-writer.agent";
import { videoSpecGeneratorAgent } from "../pipeline/agents/video-spec-generator.agent";

export const createPipelineService = async (userId: string, topic: string) => {
  const pipeline = await createPipeline(userId, topic);
  const draftScript = await scriptGeneratorAgent(topic);
  await saveDraftScript(pipeline.id, userId, draftScript);
  const factCheck = await factCheckerAgent(draftScript);

  let finalScript;
  if (factCheck?.verdict === "pass") {
    finalScript = draftScript;
  } else if (factCheck?.verdict === "revise") {
    finalScript = factCheck.revisedScript!;
  } else if (factCheck?.verdict === "needs_human") {
    throw new ApiError(
      400,
      `Issue in the script :${factCheck.issues}`,
      "Needs human intervention",
    );
  } else if (factCheck?.verdict === "unsafe") {
    throw new ApiError(
      400,
      `Script is unsafe:${factCheck.issues}`,
      "Script is not safe.",
    );
  } else {
    throw new ApiError(500, "Unexpected fact-check verdict", "Internal error");
  }
  await saveFinalScript(pipeline.id, userId, finalScript);
  const videoSpec = await videoSpecGeneratorAgent(finalScript);
  await saveVideoSpec(pipeline.id, userId, videoSpec);
  return await findPipelineById(pipeline.id, userId);
};

// import { ApiError } from "../../utils/ApiError.util";
// import { factCheckerAgent } from "./agents/fact-checker.agent";
// import { scriptGeneratorAgent } from "./agents/script-writer.agent";
// import { videoSpecGeneratorAgent } from "./agents/video-spec-generator.agent";

// export const pipelineService = async (input: string) => {
//   const script = await scriptGeneratorAgent(input);
//   console.log(script);

//   const factCheck = await factCheckerAgent(script);

//   let approvedScript;
//   if (factCheck?.verdict === "pass") {
//     approvedScript = script;
//   } else if (factCheck?.verdict === "revise") {
//     approvedScript = factCheck.revisedScript!;
//   } else if (factCheck?.verdict === "needs_human") {
//     throw new ApiError(
//       400,
//       `Issue in the script :${factCheck.issues}`,
//       "Needs human intervention",
//     );
//   } else if (factCheck?.verdict === "unsafe") {
//     throw new ApiError(
//       400,
//       `Script is unsafe:${factCheck.issues}`,
//       "Script is not safe.",
//     );
//   } else {
//     throw new ApiError(500, "Unexpected fact-check verdict", "Internal error");
//   }
//   const videoSpec = await videoSpecGeneratorAgent(approvedScript);
//   return videoSpec;
// };
