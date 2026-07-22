---
type: wayfinder:research
status: closed
blocks: [02, 03]
---

## Question

What is the exact column/field shape of the TikTok `video.insights` API response? We need to know every metric field name and type so we can build a matching dummy CSV and design the `raw_data` JSONB schema for `analytics_reports`.

## Context

TikTok sandbox environment doesn't return real data, so we'll seed a dummy CSV in the same format. The analytics agent will parse this CSV (and later the real API) to produce reports. The schema must be locked before the analytics agent prompt and the DB migration can be written.

## Resolution

### Endpoint

**`POST https://open.tiktokapis.com/v2/video/query/`** (Content Posting API, `video.list` scope) — queries the authorized user's own published videos by video ID. Up to 20 IDs per request.

This replaces the earlier assumption of using the Research API (`/v2/research/video/query/`), which requires separate TikTok approval and is scoped for academic research, not querying your own content.

### Request

```
POST https://open.tiktokapis.com/v2/video/query/?fields=id,create_time,video_description,duration,view_count,like_count,comment_count,share_count
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "filters": {
    "video_ids": ["7077642457847991554", "7080217258529737986"]
  }
}
```

### Available fields relevant to analytics

| Field | Type | Notes |
|---|---|---|
| `id` | string | TikTok video ID |
| `create_time` | int64 | Unix epoch seconds |
| `video_description` | string | caption text |
| `duration` | int | seconds |
| `view_count` | int | |
| `like_count` | int | |
| `comment_count` | int | |
| `share_count` | int | |

**Not available from this endpoint:** `favorites_count`, `music_id`, `hashtag_names`, `region_code`, `username`, `is_stem_verified`, `voice_to_text`, `playlist_id`.

**Not in any public API:** impressions, reach, average_watch_time, retention_rate, completion_rate.

### Engagement rate formula (updated)

`favorites_count` is not available from this endpoint. Engagement rate is derived as:

```
engagement_rate = (like_count + comment_count + share_count) / view_count
```

### Design implication

The analytics agent works with: `view_count`, `like_count`, `comment_count`, `share_count`, `duration`. The `TikTokVideoInsight` interface and dummy CSV should be trimmed to only the fields this endpoint actually returns. The `favorites_count` field should be removed.
