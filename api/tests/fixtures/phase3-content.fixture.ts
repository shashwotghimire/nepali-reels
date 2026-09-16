import type { ListInput, ListScriptOutput, ListVideoSpec } from "../../src/schema/list.schema";
import type { StoryInput, StoryScriptOutput, StoryVideoSpec } from "../../src/schema/story.schema";

export const factualStoryInput: StoryInput = { treatment: "factual" };
export const fictionalStoryInput: StoryInput = { treatment: "fictional" };

export const factualStoryScript: StoryScriptOutput = {
  treatment: "factual",
  disclosureNp: "यो ऐतिहासिक स्रोतमा आधारित सत्य कथा हो।",
  factualClaims: [{ claim: "घटना अभिलेखमा छ", sourceBasis: "सार्वजनिक ऐतिहासिक अभिलेख" }],
  characters: [{ id: "guide", nameNp: "पथप्रदर्शक", stableDescription: "रातो दौरा लगाएको नेपाली पथप्रदर्शक" }],
  locations: [{ id: "trail", stableDescription: "हिमाली ढुंगे बाटो" }],
  hookOptions: [
    { text: "यो बाटो किन प्रसिद्ध भयो?", style: "question" },
    { text: "एउटा यात्राले इतिहास बदल्यो।", style: "tension" },
    { text: "जवाफ यही बाटोमा छ।", style: "surprise" },
  ],
  selectedHook: "यो बाटो किन प्रसिद्ध भयो?",
  narrationNp: "यो बाटो किन प्रसिद्ध भयो? अभिलेखले यात्राको कथा देखाउँछ। कठिन मोडपछि यात्रु शिखरमा पुग्छन्। यही यात्राले बाटोलाई चिनायो।",
  shotPlan: [
    { index: 1, durationSec: 5, beat: "hook", narrationNp: "यो बाटो किन प्रसिद्ध भयो?", visual: "trail", cameraOrMotion: "push", characterIds: ["guide"], locationId: "trail", continuityNote: "guide enters from left" },
    { index: 2, durationSec: 5, beat: "setup", narrationNp: "अभिलेखले कथा देखाउँछ।", visual: "map", cameraOrMotion: "pan", characterIds: ["guide"], locationId: "trail", continuityNote: "same red daura" },
    { index: 3, durationSec: 5, beat: "climax", narrationNp: "यात्रु शिखरमा पुग्छन्।", visual: "summit", cameraOrMotion: "rise", characterIds: ["guide"], locationId: "trail", continuityNote: "same guide reaches summit" },
    { index: 4, durationSec: 5, beat: "resolution", narrationNp: "यात्राले बाटोलाई चिनायो।", visual: "wide trail", cameraOrMotion: "pull out", characterIds: ["guide"], locationId: "trail", continuityNote: "sunset after summit" },
  ],
  captions: [
    { startSec: 0, endSec: 5, text: "यो बाटो किन प्रसिद्ध भयो?" },
    { startSec: 5, endSec: 15, text: "अभिलेख र शिखरको यात्रा" },
    { startSec: 15, endSec: 20, text: "यात्राले बाटो चिनायो" },
  ],
  titleOptions: ["इतिहासको बाटो", "एक यात्राको कथा"],
  hashtags: ["#नेपाल", "#इतिहास", "#कथा"],
  platformDescription: "एउटा ऐतिहासिक यात्राको छोटो कथा।",
  estDurationSec: 20,
};

export const fictionalStoryScript: StoryScriptOutput = {
  ...factualStoryScript,
  treatment: "fictional",
  disclosureNp: "यो पूर्ण रूपमा काल्पनिक कथा हो।",
  factualClaims: [],
  narrationNp: `${factualStoryScript.selectedHook} यो पूर्ण रूपमा काल्पनिक कथा हो। अभिलेख होइन, कल्पनाले यात्रुलाई शिखरसम्म पुर्‍याउँछ।`,
};

export const factualStoryVideoSpec: StoryVideoSpec = {
  treatment: "factual",
  voiceoverText: factualStoryScript.narrationNp,
  characterBible: [{ id: "guide", stableDescription: "रातो दौरा लगाएको नेपाली पथप्रदर्शक" }],
  locationBible: [{ id: "trail", stableDescription: "हिमाली ढुंगे बाटो" }],
  scenes: factualStoryScript.shotPlan.map((shot, index) => ({
    startSec: index * 5,
    endSec: (index + 1) * 5,
    beat: shot.beat,
    bgPrompt: shot.visual,
    captionText: shot.narrationNp,
    characterIds: shot.characterIds,
    locationId: shot.locationId,
    continuityFromPrevious: shot.continuityNote,
  })),
  musicDirection: "gentle cinematic rise",
  thumbnailText: "इतिहासको बाटो",
};

export const listInput: ListInput = { itemCount: 3, order: "descending" };

export const listScript: ListScriptOutput = {
  order: "descending",
  itemCount: 3,
  rankingBasis: "documented cultural significance",
  hook: { narrationNp: "नेपालका तीन रोचक ठाउँ", durationSec: 4 },
  items: [3, 2, 1].map((number) => ({
    number,
    labelNp: `स्थान ${number}`,
    narrationNp: `नम्बर ${number} को विशेषता`,
    takeawayNp: `स्थान ${number} सम्झनुहोस्`,
    visual: `location ${number}`,
    sourceBasis: `public source ${number}`,
    durationSec: 4,
  })),
  closing: { narrationNp: "तपाईंको मनपर्ने कुन हो?", durationSec: 4 },
  narrationNp: "नेपालका तीन रोचक ठाउँ। नम्बर तीन, नम्बर दुई, नम्बर एक। तपाईंको मनपर्ने कुन हो?",
  captions: [
    { startSec: 0, endSec: 4, text: "तीन रोचक ठाउँ" },
    { startSec: 4, endSec: 16, text: "नम्बर तीनदेखि एकसम्म" },
    { startSec: 16, endSec: 20, text: "तपाईंको मनपर्ने?" },
  ],
  titleOptions: ["नेपालका टप ३", "तीन रोचक ठाउँ"],
  hashtags: ["#नेपाल", "#Top3", "#यात्रा"],
  platformDescription: "तीन ठाउँको तथ्यमा आधारित काउन्टडाउन।",
  estDurationSec: 20,
};

export const listVideoSpec: ListVideoSpec = {
  order: "descending",
  voiceoverText: listScript.narrationNp,
  scenes: [
    { startSec: 0, endSec: 4, role: "hook", itemNumber: null, bgPrompt: "Nepal map", captionText: "टप ३" },
    { startSec: 4, endSec: 8, role: "item", itemNumber: 3, bgPrompt: "location three", captionText: "नम्बर ३", onScreenText: "3 · स्थान ३" },
    { startSec: 8, endSec: 12, role: "item", itemNumber: 2, bgPrompt: "location two", captionText: "नम्बर २", onScreenText: "2 · स्थान २" },
    { startSec: 12, endSec: 16, role: "item", itemNumber: 1, bgPrompt: "location one", captionText: "नम्बर १", onScreenText: "1 · स्थान १" },
    { startSec: 16, endSec: 20, role: "closing", itemNumber: null, bgPrompt: "three locations", captionText: "तपाईंको मनपर्ने?" },
  ],
  musicDirection: "upbeat countdown",
  thumbnailText: "नेपाल टप ३",
};
