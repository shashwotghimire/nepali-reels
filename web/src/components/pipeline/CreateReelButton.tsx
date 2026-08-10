import { useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGenerateScript } from "@/hooks/api/usePipeline";
import type { ClaudeModel, VideoModel, TtsVoice } from "@/types/api/pipeline-api.types";

const CLAUDE_MODELS: { value: ClaudeModel; label: string }[] = [
  {
    value: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5",
  },
  {
    value: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    label: "Claude Sonnet 4.5",
  },
  {
    value: "global.anthropic.claude-opus-4-5-20251101-v1:0",
    label: "Claude Opus 4.5",
  },
  { value: "global.anthropic.claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "global.anthropic.claude-opus-4-6-v1", label: "Claude Opus 4.6" },
];

const VIDEO_MODELS: { value: VideoModel; label: string }[] = [
  { value: "bytedance/seedance-1-5-pro", label: "Seedance 1.5 Pro" },
  { value: "alibaba/wan-2.6", label: "Wan 2.6" },
  { value: "x-ai/grok-imagine-video", label: "Grok Imagine Video" },
];

const DEFAULT_MODEL: ClaudeModel =
  "global.anthropic.claude-sonnet-4-5-20250929-v1:0";
const DEFAULT_VIDEO_MODEL: VideoModel = "bytedance/seedance-1-5-pro";

const TTS_VOICES: { value: TtsVoice; label: string }[] = [
  { value: "aoede", label: "Aoede — female, breezy, middle pitch" },
  { value: "fenrir", label: "Fenrir — male, excitable, lower middle pitch" },
  { value: "puck", label: "Puck — male, upbeat, middle pitch" },
  { value: "zephyr", label: "Zephyr — female, bright, higher pitch" },
  { value: "kore", label: "Kore — female, firm, middle pitch" },
  { value: "charon", label: "Charon — male, informative, lower pitch" },
];

const DEFAULT_TTS_VOICE: TtsVoice = "aoede";

export default function CreateReelButton() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [model, setModel] = useState<ClaudeModel>(DEFAULT_MODEL);
  const [videoModel, setVideoModel] = useState<VideoModel>(DEFAULT_VIDEO_MODEL);
  const [ttsVoice, setTtsVoice] = useState<TtsVoice>(DEFAULT_TTS_VOICE);
  const [autoPublish, setAutoPublish] = useState(false);

  const { mutate, isPending } = useGenerateScript();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    mutate(
      { topic: topic.trim(), model, videoModel, autoPublish, ttsVoice },
      {
        onSuccess: () => {
          toast.success("Pipeline queued successfully");
          setOpen(false);
          setTopic("");
          setModel(DEFAULT_MODEL);
          setVideoModel(DEFAULT_VIDEO_MODEL);
          setTtsVoice(DEFAULT_TTS_VOICE);
          setAutoPublish(false);
        },
        onError: () => {
          toast.error("Failed to create reel. Please try again.");
        },
      },
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Create Reel
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="lg">
          <AlertDialogHeader>
            <AlertDialogTitle>New reel</AlertDialogTitle>
            <AlertDialogDescription>
              Give it a topic and we'll handle the rest — script, voice, video,
              post.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 ">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Topic</label>
              <Input
                placeholder="e.g. The history of Mustang"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isPending}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">AI Model</label>
              <Select
                value={model}
                onValueChange={(val) => setModel(val as ClaudeModel)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {CLAUDE_MODELS.find((m) => m.value === model)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CLAUDE_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Video Model</label>
              <Select
                value={videoModel}
                onValueChange={(val) => setVideoModel(val as VideoModel)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Voice</label>
              <Select
                value={ttsVoice}
                onValueChange={(val) => setTtsVoice(val as TtsVoice)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {TTS_VOICES.find((v) => v.value === ttsVoice)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TTS_VOICES.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-publish"
                checked={autoPublish}
                onCheckedChange={(v) => setAutoPublish(!!v)}
                disabled={isPending}
              />
              <Label
                htmlFor="auto-publish"
                className="text-sm font-normal cursor-pointer"
              >
                Auto-publish to TikTok when ready
              </Label>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <Button type="submit" disabled={!topic.trim() || isPending}>
                {isPending ? "Starting pipeline…" : "Start pipeline"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
