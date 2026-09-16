import { BookOpen, ListOrdered, Lightbulb } from "lucide-react";
import type { VideoType } from "@/types/api/pipeline-api.types";

export const VIDEO_TYPE_OPTIONS: ReadonlyArray<{
  value: VideoType;
  label: string;
  description: string;
  icon: typeof Lightbulb;
}> = [
  {
    value: "explainer",
    label: "Explainer",
    description: "Break down a topic clearly, with facts and visual examples.",
    icon: Lightbulb,
  },
  {
    value: "story",
    label: "Story",
    description: "Build a narrative with continuity, characters, and a clear arc.",
    icon: BookOpen,
  },
  {
    value: "list",
    label: "List / Countdown",
    description: "Structure a topic as memorable, ordered takeaways.",
    icon: ListOrdered,
  },
];
