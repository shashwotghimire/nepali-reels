import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TikTokIcon from "@/components/connections/TikTokIcon";
import type { TikTokCreatorInfo, PublishToTiktokRequest } from "@/types/api/tiktok-api.types";

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Public",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Private (Only me)",
};

interface Props {
  creatorInfo: TikTokCreatorInfo;
  videoDurationSec: number | null;
  initialCaption: string;
  isPublishing: boolean;
  onPublish: (req: Omit<PublishToTiktokRequest, "pipelineId" | "videoUrl">) => void;
}

export default function TikTokPublishForm({
  creatorInfo,
  videoDurationSec,
  initialCaption,
  isPublishing,
  onPublish,
}: Props) {
  const [caption, setCaption] = useState(initialCaption);
  const [privacyLevel, setPrivacyLevel] = useState("");
  const [allowComment, setAllowComment] = useState(false);
  const [allowDuet, setAllowDuet] = useState(false);
  const [allowStitch, setAllowStitch] = useState(false);
  const [commercialContent, setCommercialContent] = useState(false);
  const [brandOrganic, setBrandOrganic] = useState(false);
  const [brandedContent, setBrandedContent] = useState(false);
  const [isAigc, setIsAigc] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);

  const consentText =
    brandedContent
      ? "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation."
      : "By posting, you agree to TikTok's Music Usage Confirmation.";

  const exceedsDurationLimit =
    videoDurationSec != null &&
    videoDurationSec > creatorInfo.maxVideoPostDurationSec;

  const canPublish =
    caption.trim().length > 0 &&
    privacyLevel !== "" &&
    consentChecked &&
    (!commercialContent || brandOrganic || brandedContent) &&
    !exceedsDurationLimit;

  function handleSubmit() {
    if (!canPublish) return;
    onPublish({
      title: caption.trim(),
      privacyLevel,
      disableComment: !allowComment,
      disableDuet: !allowDuet,
      disableStitch: !allowStitch,
      brandContentToggle: brandedContent,
      brandOrganicToggle: brandOrganic,
      isAigc,
    });
  }

  return (
    <div className="space-y-5">
      {/* Posting as */}
      <div className="flex items-center gap-3">
        <img
          src={creatorInfo.creatorAvatarUrl}
          alt={creatorInfo.creatorNickname}
          className="size-9 rounded-full object-cover"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight truncate">
            {creatorInfo.creatorNickname}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            @{creatorInfo.creatorUsername}
          </p>
        </div>
      </div>

      {/* Caption */}
      <div className="space-y-1.5">
        <Label htmlFor="tt-caption" className="text-xs text-muted-foreground uppercase tracking-wide">
          Caption
        </Label>
        <Textarea
          id="tt-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          maxLength={2200}
          className="resize-none text-sm"
          placeholder="Write a caption…"
        />
      </div>

      {/* Privacy */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Privacy
        </Label>
        <Select value={privacyLevel} onValueChange={(value) => setPrivacyLevel(value ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose visibility" />
          </SelectTrigger>
          <SelectContent>
            {creatorInfo.privacyLevelOptions.map((opt) => (
              <SelectItem
                key={opt}
                value={opt}
                disabled={brandedContent && opt === "SELF_ONLY"}
              >
                {PRIVACY_LABELS[opt] ?? opt}
                {brandedContent && opt === "SELF_ONLY" ? " (not allowed for branded content)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Interactions */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          Interactions
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="tt-comment"
              checked={allowComment}
              onCheckedChange={(v) => setAllowComment(!!v)}
              disabled={creatorInfo.commentDisabled}
            />
            <Label
              htmlFor="tt-comment"
              className={`text-sm ${creatorInfo.commentDisabled ? "text-muted-foreground" : ""}`}
            >
              Allow comments
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tt-duet"
              checked={allowDuet}
              onCheckedChange={(v) => setAllowDuet(!!v)}
              disabled={creatorInfo.duetDisabled}
            />
            <Label
              htmlFor="tt-duet"
              className={`text-sm ${creatorInfo.duetDisabled ? "text-muted-foreground" : ""}`}
            >
              Allow Duet
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tt-stitch"
              checked={allowStitch}
              onCheckedChange={(v) => setAllowStitch(!!v)}
              disabled={creatorInfo.stitchDisabled}
            />
            <Label
              htmlFor="tt-stitch"
              className={`text-sm ${creatorInfo.stitchDisabled ? "text-muted-foreground" : ""}`}
            >
              Allow Stitch
            </Label>
          </div>
        </div>
      </div>

      {/* AI-generated content */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="tt-aigc"
          checked={isAigc}
          onCheckedChange={(v) => setIsAigc(!!v)}
        />
        <Label htmlFor="tt-aigc" className="text-sm">
          AI-generated content
        </Label>
      </div>

      {/* Commercial content */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="tt-commercial"
            checked={commercialContent}
            onCheckedChange={(v) => {
              setCommercialContent(!!v);
              if (!v) {
                setBrandOrganic(false);
                setBrandedContent(false);
              }
            }}
          />
          <Label htmlFor="tt-commercial" className="text-sm">
            This is commercial content
          </Label>
        </div>
        {commercialContent && (
          <div className="ml-6 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="tt-brand-organic"
                checked={brandOrganic}
                onCheckedChange={(v) => setBrandOrganic(!!v)}
              />
              <Label htmlFor="tt-brand-organic" className="text-sm">
                Your brand
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="tt-branded-content"
                checked={brandedContent}
                onCheckedChange={(v) => {
                  setBrandedContent(!!v);
                  if (v && privacyLevel === "SELF_ONLY") setPrivacyLevel("");
                }}
              />
              <Label htmlFor="tt-branded-content" className="text-sm">
                Branded content
              </Label>
            </div>
            {(brandOrganic || brandedContent) && (
              <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1.5">
                {brandedContent
                  ? "Your photo/video will be labeled as 'Paid partnership'."
                  : "Your photo/video will be labeled as 'Promotional content'."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Consent */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="tt-consent"
          checked={consentChecked}
          onCheckedChange={(v) => setConsentChecked(!!v)}
          className="mt-0.5"
        />
        <Label htmlFor="tt-consent" className="text-sm leading-snug">
          {consentText}
        </Label>
      </div>

      {/* Duration warning */}
      {exceedsDurationLimit && (
        <p className="text-xs text-destructive">
          This video is {videoDurationSec!.toFixed(1)}s but your TikTok account allows a maximum of {creatorInfo.maxVideoPostDurationSec}s. You cannot post this video.
        </p>
      )}

      {/* Processing notice */}
      <p className="text-xs text-muted-foreground">
        It may take a few minutes for your post to process and appear on your TikTok profile.
      </p>

      {/* Publish button */}
      <Button
        className="w-full"
        disabled={!canPublish || isPublishing}
        onClick={handleSubmit}
      >
        {isPublishing ? (
          <Spinner className="size-4 mr-2" />
        ) : (
          <TikTokIcon />
        )}
        {isPublishing ? "Publishing to TikTok…" : "Publish to TikTok"}
      </Button>
    </div>
  );
}
