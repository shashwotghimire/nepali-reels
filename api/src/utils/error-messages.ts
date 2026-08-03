import { ApiError } from "./ApiError.util.js";

const USER_FRIENDLY_FALLBACK = "Something went wrong while generating your reel. Please try again.";

export function toUserFriendlyError(err: unknown): string {
  if (err instanceof ApiError && err.error) {
    return err.error;
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("Failed to parse structured output") || message.includes("Validation issues")) {
    return "The AI produced an unexpected response. Please try again — this usually resolves on a retry.";
  }

  if (message.includes("rate limit") || message.includes("429") || message.includes("throttl")) {
    return "The AI service is busy right now. Please try again in a few minutes.";
  }

  if (message.includes("timeout") || message.includes("ETIMEDOUT") || message.includes("ECONNRESET")) {
    return "The request timed out. Please try again.";
  }

  if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
    return "Could not reach the AI service. Please try again later.";
  }

  if (message.includes("didn't finish within") || message.includes("didnt finish within")) {
    return "The AI took too long to produce a result. Please try again.";
  }

  if (message.includes("returned null output") || message.includes("failed")) {
    return "One of the generation steps failed. Please try again.";
  }

  if (message.includes("video generation") || message.includes("Video generation")) {
    return "Video generation failed. Please try again — if the issue persists, try a different video model.";
  }

  if (message.includes("TTS") || message.includes("tts") || message.includes("audio")) {
    return "Audio generation failed. Please try again.";
  }

  if (message.includes("500") || message.includes("502") || message.includes("503")) {
    return "An external service is temporarily unavailable. Please try again later.";
  }

  return USER_FRIENDLY_FALLBACK;
}
