import { Check, Circle, LoaderCircle, TriangleAlert } from "lucide-react";
import type { VideoType, WorkflowProgressState } from "@/types/api/pipeline-api.types";
import { getWorkflowStageLabel } from "./workflow-progress.config";

interface WorkflowProgressProps {
  videoType: VideoType;
  progress: WorkflowProgressState;
}

export default function WorkflowProgress({ videoType, progress }: WorkflowProgressProps) {
  return (
    <section className="space-y-3" aria-label="Workflow progress">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">Workflow progress</h2>
        {progress.stages.some((stage) => stage.status === "failed") && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <TriangleAlert className="size-3.5" /> Workflow stopped
          </span>
        )}
      </div>
      <ol className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {progress.stages.map((step) => {
          const isComplete = step.status === "succeeded";
          const isActive = step.status === "running";
          const isFailed = step.status === "failed";
          const StepIcon = isComplete ? Check : isActive ? LoaderCircle : Circle;

          return (
            <li
              key={step.stage}
              className={`rounded-md border px-3 py-2 ${
                isFailed ? "border-destructive bg-destructive/10" : isActive ? "border-primary bg-primary/10" : isComplete ? "bg-muted/60" : "text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <StepIcon className={`size-3.5 shrink-0 ${isActive ? "animate-spin text-primary" : ""}`} />
                <span className="text-xs font-medium leading-tight">{getWorkflowStageLabel(step.stage, videoType)}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
