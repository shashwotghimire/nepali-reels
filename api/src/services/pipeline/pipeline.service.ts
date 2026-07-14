import { ApiError } from "../../utils/ApiError.util";
import { factCheckerAgent } from "./agents/fact-checker.agent";
import { scriptGeneratorAgent } from "./agents/script-writer.agent";
import { videoSpecGeneratorAgent } from "./agents/video-spec-generator.agent";

export const pipelineService = async (input: string) => {
  const script = await scriptGeneratorAgent(input);
  console.log(script);

  const factCheck = await factCheckerAgent(script);

  let approvedScript;
  if (factCheck?.verdict === "pass") {
    approvedScript = script;
  } else if (factCheck?.verdict === "revise") {
    approvedScript = factCheck.revisedScript!;
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
  const videoSpec = await videoSpecGeneratorAgent(approvedScript);
  return videoSpec;
};
