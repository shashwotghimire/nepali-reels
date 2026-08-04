export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export interface AgentResult<T> {
  data: T;
  usage: LlmUsage;
}
