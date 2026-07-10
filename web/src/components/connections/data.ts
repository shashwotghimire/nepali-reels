import TikTokIcon from "@/components/connections/TikTokIcon";
import YouTubeIcon from "@/components/connections/YouTubeIcon";
import InstagramIcon from "@/components/connections/InstagramIcon";
import { createElement } from "react";
import type { Platform, LogEntry } from "@/components/connections/types";

export const platforms: Platform[] = [
  {
    id: "tiktok",
    name: "TikTok",
    handle: "@official_nepalireels",
    status: "connected",
    icon: createElement(TikTokIcon),
    iconBg: "bg-black",
    constraints: "Unrestricted publishing active",
    constraintIcon: "check",
    lastSync: "2023-10-24 14:22:01 UTC",
  },
  {
    id: "youtube",
    name: "YouTube",
    handle: "Nepali_Reels (Global)",
    status: "review_pending",
    icon: createElement(YouTubeIcon),
    iconBg: "bg-red-600",
    constraints: "Private only · Platform Review in progress",
    constraintIcon: "warning",
    actionRequired: "Validate monetization eligibility via OAuth.",
  },
  {
    id: "instagram",
    name: "Instagram",
    handle: null,
    status: "disconnected",
    icon: createElement(InstagramIcon),
    iconBg: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
    constraints: "No active publishing pipeline",
    constraintIcon: "none",
    availableTiers: "Reels, Stories, and Grid Posts",
  },
];

export const logEntries: LogEntry[] = [
  {
    pipelineId: "NR-CONN-821",
    platform: "TikTok",
    event: "Token Refresh Successful",
    timestamp: "2023-10-24 09:00:02",
    statusCode: "288_OK",
    statusColor: "text-green-600",
  },
  {
    pipelineId: "NR-CONN-794",
    platform: "YouTube",
    event: "OAuth Handshake Initiated",
    timestamp: "2023-10-23 21:15:44",
    statusCode: "481_PENDING",
    statusColor: "text-yellow-500",
  },
  {
    pipelineId: "NR-CONN-512",
    platform: "Instagram",
    event: "Manual Disconnect by Admin",
    timestamp: "2023-10-22 12:40:10",
    statusCode: "503_INACTIVE",
    statusColor: "text-red-500",
  },
];
