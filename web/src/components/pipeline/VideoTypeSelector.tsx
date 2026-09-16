import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { VideoType } from "@/types/api/pipeline-api.types";
import { VIDEO_TYPE_OPTIONS } from "./video-type-options";

interface VideoTypeSelectorProps {
  value: VideoType;
  disabled?: boolean;
  onChange: (value: VideoType) => void;
}

export default function VideoTypeSelector({
  value,
  disabled,
  onChange,
}: VideoTypeSelectorProps) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">Video type</legend>
      <RadioGroup
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as VideoType)}
        className="grid gap-2 sm:grid-cols-3"
      >
        {VIDEO_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = option.value === value;

          return (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors ${
                selected ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-muted/60"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="size-4" aria-hidden="true" />
                  {option.label}
                </span>
                <RadioGroupItem value={option.value} aria-label={option.label} />
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {option.description}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
