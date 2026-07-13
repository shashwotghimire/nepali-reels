import { scriptGeneratorAgent } from "./agents/script-writer.agent";

export const pipelineService = async (input: string) => {
  return await scriptGeneratorAgent(input);
};
