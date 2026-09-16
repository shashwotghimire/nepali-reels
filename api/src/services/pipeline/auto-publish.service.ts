export type AutoPublishResult =
  | { publishId: string }
  | { skipped: true; error: string };

/** Auto-publish is best effort; a generated reel remains a successful result. */
export async function attemptAutoPublish(
  pipelineId: string,
  submit: () => Promise<string>,
): Promise<AutoPublishResult> {
  try {
    return { publishId: await submit() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pipeline:${pipelineId}] TikTok auto-publish skipped: ${message}`);
    return { skipped: true, error: message };
  }
}
