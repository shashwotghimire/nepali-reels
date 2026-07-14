import { ApiError } from "../../utils/ApiError.util";
import { factCheckerAgent } from "./agents/fact-checker.agent";
import { scriptGeneratorAgent } from "./agents/script-writer.agent";

export const pipelineService = async (input: string) => {
  const script = await scriptGeneratorAgent(input);
  console.log(script);
  const factCheck = await factCheckerAgent(script);
  if (factCheck?.verdict === "pass") return script;
  if (factCheck?.verdict === "revise") return factCheck.revisedScript!;
  if (factCheck?.verdict === "needs_human")
    throw new ApiError(
      400,
      `Issue in the script :${factCheck.issues}`,
      "Needs human intervention",
    );
  if (factCheck?.verdict === "unsafe")
    throw new ApiError(
      400,
      `Script is unsafe:${factCheck.issues}`,
      "Script is not safe.",
    );
  throw new ApiError(500, "Unexpected fact-check verdict", "Internal error");
};
