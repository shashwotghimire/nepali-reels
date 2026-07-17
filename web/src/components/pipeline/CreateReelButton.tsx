import { useState } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { ClaudeModel } from "@/types/api/pipeline-api.types";

const MODELS: ClaudeModel[] = [
  "global.anthropic.claude-haiku-4-5-20251001-v1:0",
  "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
  "global.anthropic.claude-opus-4-5-20251101-v1:0",
];

const modelLabel = (model: ClaudeModel) =>
  model.split("claude-")[1]?.split("-v")[0] ?? model;

const DEFAULT_MODEL: ClaudeModel = "global.anthropic.claude-sonnet-4-5-20250929-v1:0";

export default function CreateReelButton() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [model, setModel] = useState<ClaudeModel>(DEFAULT_MODEL);

  const { mutate, isPending } = useGenerateScript();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    mutate(
      { topic: topic.trim(), model },
      {
        onSuccess: () => {
          toast.success("Pipeline queued successfully");
          setOpen(false);
          setTopic("");
          setModel(DEFAULT_MODEL);
        },
        onError: () => {
          toast.error("Failed to create reel. Please try again.");
        },
      }
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Create Reel
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Create new reel</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a topic and select a model to start the pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Topic</label>
              <Input
                placeholder="e.g. History of Everest"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isPending}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Model</label>
              <Select
                value={model}
                onValueChange={(val) => setModel(val as ClaudeModel)}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {modelLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <Button type="submit" disabled={!topic.trim() || isPending}>
                {isPending ? "Creating…" : "Create"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
