import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ScriptApprovalPanel from "@/components/pipeline/ScriptApprovalPanel";
import ThumbnailVersions from "@/components/pipeline/ThumbnailVersions";
import OperationIssuePanel from "@/components/pipeline/OperationIssuePanel";
import type { Reel } from "@/types/api/pipeline-api.types";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const reel = {
  id: "11111111-1111-4111-8111-111111111111", userId: "fixture", topic: "नेपालका हिमाली बाटाहरू", claudeModel: "global.anthropic.claude-sonnet-4-5-20250929-v1:0", videoModel: "bytedance/seedance-1-5-pro", videoType: "explainer", workflowVersion: 1, ttsVoice: "aoede", contentInput: { videoType: "explainer" }, draftScript: null,
  finalScript: { hookOptions: [{ text: "A", style: "question" }, { text: "B", style: "shock" }, { text: "C", style: "story" }], selectedHook: "A", narrationNp: "नेपालका बाटाहरूको कथा", shotPlan: [{ index: 1, durationSec: 4, visual: "mountain", cameraOrMotion: "pan" }, { index: 2, durationSec: 4, visual: "road", cameraOrMotion: "track" }, { index: 3, durationSec: 4, visual: "village", cameraOrMotion: "still" }], onScreenText: [], captions: [{ startSec: 0, endSec: 4, text: "नेपाल" }, { startSec: 4, endSec: 8, text: "बाटो" }, { startSec: 8, endSec: 12, text: "कथा" }], titleOptions: ["बाटो", "यात्रा"], hashtags: ["नेपाल", "यात्रा", "हिमाल"], platformDescription: "fixture", estDurationSec: 12 }, videoSpec: null, soundSpec: null, pipelineStatus: "awaiting_script_approval", failureReason: null, s3key: null, videoDurationSec: null, videoUrl: null, costUsd: 0.02, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), scriptVersion: 2, scriptRevisionCount: 1, scriptApprovedAt: null, approvedScriptFingerprint: null, thumbnailUrl: null, thumbnailVersions: null, selectedThumbnailVersion: null, operationIssues: [{ kind: "script_revision", idempotencyKey: "fixture-key", status: "uncertain", error: "connection lost" }],
} satisfies Reel;

export default function Phase4VisualReview() { return <QueryClientProvider client={client}><main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8"><h1 className="text-2xl font-semibold">Phase 4 creation review</h1><OperationIssuePanel reel={reel} /><ScriptApprovalPanel reel={reel} /><ThumbnailVersions reel={reel} /></main></QueryClientProvider>; }
