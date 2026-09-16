import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ListInput, StoryInput, VideoType } from "@/types/api/pipeline-api.types";

interface VideoTypeFieldsProps {
  videoType: VideoType;
  storyInput: StoryInput;
  listInput: ListInput;
  disabled?: boolean;
  onStoryInputChange: (value: StoryInput) => void;
  onListInputChange: (value: ListInput) => void;
}

export default function VideoTypeFields({
  videoType,
  storyInput,
  listInput,
  disabled,
  onStoryInputChange,
  onListInputChange,
}: VideoTypeFieldsProps) {
  if (videoType === "story") {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Story treatment</label>
        <Select
          value={storyInput.treatment}
          onValueChange={(treatment) =>
            onStoryInputChange({ treatment: treatment as StoryInput["treatment"] })
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="factual">Factual — grounded in verifiable events</SelectItem>
            <SelectItem value="fictional">Fictional — clearly presented as a made-up story</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (videoType === "list") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="list-item-count" className="text-sm font-medium">Number of items</label>
          <Input
            id="list-item-count"
            type="number"
            min={3}
            max={10}
            value={listInput.itemCount}
            onChange={(event) =>
              onListInputChange({ ...listInput, itemCount: Number(event.target.value) })
            }
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Order</label>
          <Select
            value={listInput.order}
            onValueChange={(order) =>
              onListInputChange({ ...listInput, order: order as ListInput["order"] })
            }
            disabled={disabled}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="descending">Countdown — highest number to #1</SelectItem>
              <SelectItem value="ascending">Ascending — #1 upward</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return null;
}
