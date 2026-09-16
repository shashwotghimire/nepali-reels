import type {
  ListScriptOutput,
  ListVideoSpec,
  StoryScriptOutput,
  StoryVideoSpec,
  WorkflowProgressState,
} from "@/types/api/pipeline-api.types";

export const storyReviewScript: StoryScriptOutput = {
  treatment: "fictional",
  disclosureNp: "यो पूर्ण रूपमा काल्पनिक कथा हो।",
  factualClaims: [],
  characters: [{ id: "maya", nameNp: "माया", stableDescription: "नीलो सल लगाएकी युवा पदयात्री" }],
  locations: [{ id: "trail", stableDescription: "बिहानीको हिमाली ढुंगे बाटो" }],
  hookOptions: [{ text: "घण्टी आफैं किन बज्यो?", style: "question" }, { text: "माया एक्लै थिइन्।", style: "tension" }, { text: "बाटोले रहस्य लुकाएको थियो।", style: "surprise" }],
  selectedHook: "घण्टी आफैं किन बज्यो?",
  narrationNp: "घण्टी आफैं किन बज्यो? यो पूर्ण रूपमा काल्पनिक कथा हो। माया सुनसान बाटोमा रोकिइन्। आवाज पछ्याउँदा उनले हराएको चौँरी भेटिन्। बिहानसम्म दुवै सुरक्षित गाउँ पुगे।",
  shotPlan: [
    { index: 1, durationSec: 5, beat: "hook", narrationNp: "घण्टी आफैं किन बज्यो?", visual: "misty trail", cameraOrMotion: "slow push", characterIds: ["maya"], locationId: "trail", continuityNote: "blue shawl, dawn mist" },
    { index: 2, durationSec: 5, beat: "setup", narrationNp: "माया रोकिइन्।", visual: "traveler listens", cameraOrMotion: "pan", characterIds: ["maya"], locationId: "trail", continuityNote: "same shawl and light" },
    { index: 3, durationSec: 5, beat: "climax", narrationNp: "हराएको चौँरी भेटिन्।", visual: "yak appears", cameraOrMotion: "reveal", characterIds: ["maya"], locationId: "trail", continuityNote: "traveler faces uphill" },
    { index: 4, durationSec: 5, beat: "resolution", narrationNp: "दुवै गाउँ पुगे।", visual: "village sunrise", cameraOrMotion: "wide pull", characterIds: ["maya"], locationId: "trail", continuityNote: "sunrise follows dawn" },
  ],
  captions: [{ startSec: 0, endSec: 6, text: "रहस्यमय घण्टी" }, { startSec: 6, endSec: 15, text: "हराएको चौँरी" }, { startSec: 15, endSec: 20, text: "सुरक्षित गाउँ" }],
  titleOptions: ["घण्टीको रहस्य", "मायाको हिमाली कथा"],
  hashtags: ["#नेपालीकथा", "#काल्पनिक", "#हिमाल"],
  platformDescription: "एउटा छोटो काल्पनिक हिमाली कथा।",
  estDurationSec: 20,
};

export const storyReviewSpec: StoryVideoSpec = {
  treatment: "fictional",
  voiceoverText: storyReviewScript.narrationNp,
  characterBible: [{ id: "maya", stableDescription: "नीलो सल लगाएकी युवा पदयात्री" }],
  locationBible: [{ id: "trail", stableDescription: "बिहानीको हिमाली ढुंगे बाटो" }],
  scenes: storyReviewScript.shotPlan.map((shot, index) => ({ startSec: index * 5, endSec: (index + 1) * 5, beat: shot.beat, bgPrompt: shot.visual, captionText: shot.narrationNp, characterIds: shot.characterIds, locationId: shot.locationId, continuityFromPrevious: shot.continuityNote })),
  musicDirection: "soft suspense resolving warmly",
  thumbnailText: "घण्टीको रहस्य",
};

export const listReviewScript: ListScriptOutput = {
  order: "descending", itemCount: 3, rankingBasis: "documented cultural significance",
  hook: { narrationNp: "नेपालका तीन अद्भुत जात्रा", durationSec: 4 },
  items: [3, 2, 1].map((number) => ({ number, labelNp: `जात्रा ${number}`, narrationNp: `नम्बर ${number} को कथा`, takeawayNp: `जात्रा ${number} सम्झनुहोस्`, visual: `festival ${number}`, sourceBasis: `public record ${number}`, durationSec: 4 })),
  closing: { narrationNp: "तपाईं कुन जात्रा हेर्न चाहनुहुन्छ?", durationSec: 4 },
  narrationNp: "नेपालका तीन अद्भुत जात्रा। नम्बर तीन, नम्बर दुई, अनि नम्बर एक।",
  captions: [{ startSec: 0, endSec: 4, text: "टप ३ जात्रा" }, { startSec: 4, endSec: 16, text: "३, २, १" }, { startSec: 16, endSec: 20, text: "तपाईंको रोजाइ?" }],
  titleOptions: ["नेपालका टप ३ जात्रा", "कुन जात्रा नम्बर १?"], hashtags: ["#नेपाल", "#जात्रा", "#Top3"], platformDescription: "तथ्यमा आधारित काउन्टडाउन।", estDurationSec: 20,
};

export const listReviewSpec: ListVideoSpec = {
  order: "descending", voiceoverText: listReviewScript.narrationNp,
  scenes: [
    { startSec: 0, endSec: 4, role: "hook", itemNumber: null, bgPrompt: "festival collage", captionText: "टप ३" },
    { startSec: 4, endSec: 8, role: "item", itemNumber: 3, bgPrompt: "festival three", captionText: "नम्बर ३", onScreenText: "3 · जात्रा ३" },
    { startSec: 8, endSec: 12, role: "item", itemNumber: 2, bgPrompt: "festival two", captionText: "नम्बर २", onScreenText: "2 · जात्रा २" },
    { startSec: 12, endSec: 16, role: "item", itemNumber: 1, bgPrompt: "festival one", captionText: "नम्बर १", onScreenText: "1 · जात्रा १" },
    { startSec: 16, endSec: 20, role: "closing", itemNumber: null, bgPrompt: "festival crowd", captionText: "तपाईंको रोजाइ?" },
  ], musicDirection: "bright rhythmic countdown", thumbnailText: "टप ३ जात्रा",
};

export const storyReviewProgress: WorkflowProgressState = {
  orderedStages: ["story_script", "story_continuity", "story_fact_safety", "story_video_spec", "audio", "alignment", "video", "thumbnail", "render", "upload", "notify", "publish"],
  currentStage: "video",
  stages: ["story_script", "story_continuity", "story_fact_safety", "story_video_spec", "audio", "alignment", "video", "thumbnail", "render", "upload", "notify", "publish"].map((stage, index) => ({ stage, status: index < 6 ? "succeeded" : index === 6 ? "running" : "pending" })),
};

export const listReviewProgress: WorkflowProgressState = {
  orderedStages: ["list_script", "list_structure", "list_fact_check", "list_video_spec", "audio", "alignment", "video", "thumbnail", "render", "upload", "notify", "publish"],
  currentStage: "list_fact_check",
  stages: ["list_script", "list_structure", "list_fact_check", "list_video_spec", "audio", "alignment", "video", "thumbnail", "render", "upload", "notify", "publish"].map((stage, index) => ({ stage, status: index < 2 ? "succeeded" : index === 2 ? "running" : "pending" })),
};
