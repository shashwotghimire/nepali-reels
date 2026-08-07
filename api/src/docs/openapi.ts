export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Nepali Reels API",
    version: "1.0.0",
    description:
      "API for the Nepali Reels platform — turn a topic into a published Nepali short-form video. " +
      "Users create a **reel** (pipeline) from a topic, the pipeline generates a script, TTS audio, AI video " +
      "and finally a composited MP4 that can be published to TikTok.\n\n" +
      "> **Auth:** every endpoint except the OAuth flows requires a session cookie set by better-auth " +
      "(`better-auth.session_token`). Authenticate via `POST /api/auth/sign-in/google`.\n" +
      "> **Long-running jobs:** `POST /api/pipeline/generate-script` and `POST /api/pipeline/:id/retry` enqueue " +
      "a BullMQ job and return `202 Accepted` immediately. Poll `GET /api/pipeline/:id` to watch progress.",
    contact: {
      name: "Nepali Reels",
    },
  },
  servers: [{ url: "/" }],
  security: [{ cookieAuth: [] }],
  tags: [
    { name: "Auth", description: "Session management via better-auth" },
    { name: "Users", description: "Current user profile" },
    {
      name: "Pipelines",
      description: "Reel creation, retrieval and media download",
    },
    { name: "TikTok", description: "TikTok OAuth connection and publishing" },
    { name: "Analytics", description: "Weekly engagement reports" },
  ],
  paths: {
    "/api/auth/sign-in/google": {
      post: {
        tags: ["Auth"],
        summary: "Sign in with Google (OAuth)",
        description:
          "Redirects the browser to Google OAuth. On success better-auth sets the session cookie " +
          "and redirects back to the frontend.",
        operationId: "authSignInGoogle",
        responses: {
          "302": {
            description: "Redirect to Google authorization page",
          },
        },
      },
    },
    "/api/auth/get-session": {
      get: {
        tags: ["Auth"],
        summary: "Get current session",
        operationId: "authGetSession",
        responses: {
          "200": {
            description: "Session data",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/sign-out": {
      post: {
        tags: ["Auth"],
        summary: "Sign out",
        operationId: "authSignOut",
        responses: {
          "200": {
            description: "Session destroyed and cookie cleared",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SignOutResponse" },
              },
            },
          },
        },
      },
    },
    "/api/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current user profile",
        operationId: "getCurrentUser",
        responses: {
          "200": {
            description: "User profile fetched",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/pipeline/generate-script": {
      post: {
        tags: ["Pipelines"],
        summary: "Create a new reel (pipeline)",
        description:
          "Enqueues the pipeline job and returns immediately. The pipeline runs through script writing, " +
          "fact checking, linguistic review, video spec, TTS, video generation and compositing. " +
          "Poll `GET /api/pipeline/:id` to watch the `pipelineStatus`.",
        operationId: "generateScript",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/GenerateScriptRequest" },
            },
          },
        },
        responses: {
          "202": {
            description: "Pipeline queued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenerateScriptResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/pipeline": {
      get: {
        tags: ["Pipelines"],
        summary: "List reels",
        description: "Paginated list of the current user's reels.",
        operationId: "listReels",
        parameters: [
          {
            name: "page",
            in: "query",
            description: "Page number (1-based). Defaults to 1.",
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "limit",
            in: "query",
            description: "Items per page. Defaults to 10, max 100.",
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
          {
            name: "search",
            in: "query",
            description: "Free-text search against the reel topic.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Paginated reels",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReelsListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/pipeline/{id}": {
      get: {
        tags: ["Pipelines"],
        summary: "Get a reel by ID",
        operationId: "getPipelineById",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Pipeline UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Reel fetched",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PipelineResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Pipelines"],
        summary: "Delete a reel",
        operationId: "deletePipeline",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Pipeline UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Reel deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/pipeline/{id}/audio": {
      get: {
        tags: ["Pipelines"],
        summary: "Get generated TTS audio",
        description:
          "Streams the generated `.wav` audio. Supports HTTP range requests. Returns 404 if audio has not been generated yet.",
        operationId: "getPipelineAudio",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Pipeline UUID",
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "Range",
            in: "header",
            description: "HTTP range request, e.g. `bytes=0-1024`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Audio stream",
            content: {
              "audio/wav": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "206": {
            description: "Partial audio content",
            headers: {
              "Content-Range": {
                schema: { type: "string" },
              },
            },
            content: {
              "audio/wav": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/pipeline/{id}/video": {
      get: {
        tags: ["Pipelines"],
        summary: "Get composited video",
        description:
          "Redirects to the CDN URL when the video is uploaded to S3, otherwise streams the local MP4 with range support.",
        operationId: "getPipelineVideo",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Pipeline UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Video stream",
            content: {
              "video/mp4": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "206": {
            description: "Partial video content",
            headers: {
              "Content-Range": {
                schema: { type: "string" },
              },
            },
            content: {
              "video/mp4": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "302": {
            description: "Redirect to CloudFront CDN URL",
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/pipeline/{id}/retry": {
      post: {
        tags: ["Pipelines"],
        summary: "Retry a failed reel",
        description:
          "Re-enqueues the pipeline job, resuming from the last saved checkpoint. Returns 202 immediately.",
        operationId: "retryPipeline",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Pipeline UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "202": {
            description: "Retry queued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RetryResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/tiktok/connect": {
      get: {
        tags: ["TikTok"],
        summary: "Start TikTok OAuth connection",
        description:
          "Sets a signed state cookie and redirects the browser to TikTok's authorization page.",
        operationId: "connectTiktok",
        responses: {
          "302": {
            description: "Redirect to TikTok authorization",
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/tiktok/callback": {
      get: {
        tags: ["TikTok"],
        summary: "TikTok OAuth callback",
        description:
          "Exchanges the TikTok authorization code for tokens, stores the connection and redirects back to the frontend connections page.",
        operationId: "tiktokCallback",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            description: "OAuth authorization code",
            schema: { type: "string" },
          },
          {
            name: "state",
            in: "query",
            required: true,
            description: "OAuth state (must match the signed cookie)",
            schema: { type: "string" },
          },
          {
            name: "error",
            in: "query",
            description: "Present when TikTok rejects the request",
            schema: { type: "string" },
          },
        ],
        responses: {
          "302": {
            description: "Redirect to frontend connections page",
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/tiktok/status": {
      get: {
        tags: ["TikTok"],
        summary: "Get TikTok connection status",
        operationId: "getTiktokStatus",
        responses: {
          "200": {
            description: "Connection status",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TiktokStatusResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/tiktok/disconnect": {
      delete: {
        tags: ["TikTok"],
        summary: "Disconnect TikTok account",
        operationId: "disconnectTiktok",
        responses: {
          "200": {
            description: "Account disconnected",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SimpleResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/tiktok/creator-info": {
      post: {
        tags: ["TikTok"],
        summary: "Get TikTok creator info",
        description: "Fetches creator profile and publishing limits from TikTok.",
        operationId: "getCreatorInfo",
        responses: {
          "200": {
            description: "Creator info fetched",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatorInfoResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/tiktok/publish": {
      post: {
        tags: ["TikTok"],
        summary: "Publish a reel to TikTok",
        description:
          "Initiates a `PULL_FROM_URL` publish against TikTok. The video must already be generated and uploaded to S3.",
        operationId: "publishVideo",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PublishVideoRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Publish initiated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublishVideoResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/analytics/latest": {
      get: {
        tags: ["Analytics"],
        summary: "Get latest analytics report",
        operationId: "getLatestAnalytics",
        responses: {
          "200": {
            description: "Latest report",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AnalyticsResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/analytics/history": {
      get: {
        tags: ["Analytics"],
        summary: "Get all analytics reports",
        operationId: "getAllAnalytics",
        responses: {
          "200": {
            description: "All reports",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AnalyticsListResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
      },
    },
    schemas: {
      PipelineStatus: {
        type: "string",
        enum: [
          "queued",
          "script_generated",
          "script_finalised",
          "linguistic_reviewed",
          "video_spec_generated",
          "sound_generated",
          "video_generated",
          "publish_pending",
          "published",
          "failed",
        ],
      },
      ClaudeModel: {
        type: "string",
        enum: ["Haiku 4.5", "Sonnet 4.5", "Sonnet 4.6", "Opus 4.5", "Opus 4.6"],
      },
      VideoModel: {
        type: "string",
        enum: ["Seedance 1.5 Pro", "Wan 2.6", "Grok Imagine Video"],
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", description: "better-auth user id" },
          name: { type: "string" },
          email: { type: "string" },
          emailVerified: { type: "boolean" },
          image: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Reel: {
        type: "object",
        description: "A pipeline record (one reel). JSONB stages hold agent outputs.",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string" },
          topic: { type: "string" },
          claudeModel: { type: "string" },
          videoModel: { type: "string" },
          draftScript: { type: ["object", "null"], description: "Script writer agent output" },
          finalScript: { type: ["object", "null"], description: "Finalised Nepali script" },
          videoSpec: { type: ["object", "null"], description: "Scene breakdown" },
          soundSpec: { type: ["object", "null"], description: "TTS + alignment output" },
          pipelineStatus: { $ref: "#/components/schemas/PipelineStatus" },
          videoDurationSec: { type: ["number", "null"], format: "float" },
          s3key: { type: ["string", "null"], description: "S3 object key of the final MP4" },
          tiktokPublishId: { type: ["string", "null"] },
          thumbnailUrl: { type: ["string", "null"] },
          costUsd: { type: ["number", "null"], format: "float" },
          failureReason: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ReelListItem: {
        allOf: [
          { $ref: "#/components/schemas/Reel" },
          {
            type: "object",
            properties: {
              videoUrl: { type: ["string", "null"], description: "CDN URL of the final video" },
            },
          },
        ],
      },
      GenerateScriptRequest: {
        type: "object",
        required: ["topic"],
        properties: {
          topic: {
            type: "string",
            minLength: 3,
            description: "The topic to turn into a Nepali video",
          },
          model: {
            $ref: "#/components/schemas/ClaudeModel",
            default: "Sonnet 4.5",
          },
          videoModel: {
            $ref: "#/components/schemas/VideoModel",
            default: "Seedance 1.5 Pro",
          },
        },
      },
      PublishVideoRequest: {
        type: "object",
        required: [
          "pipelineId",
          "title",
          "privacyLevel",
          "disableComment",
          "disableDuet",
          "disableStitch",
          "brandContentToggle",
          "brandOrganicToggle",
          "isAigc",
        ],
        properties: {
          pipelineId: { type: "string", format: "uuid" },
          title: { type: "string", minLength: 1, maxLength: 2200 },
          privacyLevel: { type: "string", description: "Must be in the creator's `privacy_level_options`, e.g. `PUBLIC_TO_EVERYONE`" },
          disableComment: { type: "boolean" },
          disableDuet: { type: "boolean" },
          disableStitch: { type: "boolean" },
          brandContentToggle: { type: "boolean" },
          brandOrganicToggle: { type: "boolean" },
          isAigc: { type: "boolean", description: "Mark content as AI-generated" },
        },
      },
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          data: {},
        },
      },
      SimpleResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { type: "null", nullable: true },
        },
      },
      UserResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { $ref: "#/components/schemas/User" },
        },
      },
      PipelineResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { $ref: "#/components/schemas/Reel" },
        },
      },
      ReelsListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              reels: {
                type: "array",
                items: { $ref: "#/components/schemas/ReelListItem" },
              },
              totalItems: { type: "integer" },
              totalPages: { type: "integer" },
              currentPage: { type: "integer" },
            },
          },
        },
      },
      GenerateScriptResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Pipeline queued successfully" },
          data: {
            type: "object",
            properties: {
              pipelineId: { type: "string", format: "uuid" },
              model: { type: "string" },
              videoModel: { type: "string" },
            },
          },
        },
      },
      RetryResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Pipeline retry queued" },
          data: {
            type: "object",
            properties: {
              pipelineId: { type: "string", format: "uuid" },
              resumeFrom: { $ref: "#/components/schemas/PipelineStatus" },
            },
          },
        },
      },
      TiktokStatusResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              connected: { type: "boolean" },
              tokenExpired: { type: "boolean" },
              tiktokUserId: { type: ["string", "null"] },
              profile: {
                type: ["object", "null"],
                properties: {
                  display_name: { type: ["string", "null"] },
                  avatar_url: { type: ["string", "null"] },
                  username: { type: ["string", "null"] },
                },
              },
            },
          },
        },
      },
      CreatorInfoResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              creatorAvatarUrl: { type: "string" },
              creatorUsername: { type: "string" },
              creatorNickname: { type: "string" },
              privacyLevelOptions: {
                type: "array",
                items: { type: "string" },
              },
              commentDisabled: { type: "boolean" },
              duetDisabled: { type: "boolean" },
              stitchDisabled: { type: "boolean" },
              maxVideoPostDurationSec: { type: "integer" },
            },
          },
        },
      },
      PublishVideoResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string", example: "Video published to TikTok." },
          data: {
            type: "object",
            properties: {
              publishId: { type: "string", description: "TikTok publish_id (polls until PUBLISH_COMPLETE)" },
            },
          },
        },
      },
      AnalyticsReport: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string" },
          rawData: {
            type: "array",
            description: "Per-video TikTok insights",
            items: { type: "object" },
          },
          report: { type: ["object", "null"], description: "Claude engagement analysis" },
          suggestions: { type: ["object", "null"], description: "Suggested topics for next week" },
          fetchedAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AnalyticsResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: { $ref: "#/components/schemas/AnalyticsReport" },
        },
      },
      AnalyticsListResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          message: { type: "string" },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/AnalyticsReport" },
          },
        },
      },
      SessionResponse: {
        type: "object",
        description: "better-auth session payload",
        properties: {
          session: { type: "object" },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      SignOutResponse: {
        type: "object",
        description: "better-auth sign-out payload",
        properties: {
          success: { type: "boolean" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Invalid or expired session",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                message: { type: "string", example: "Invalid or expired login" },
                error: { type: "string", example: "Unauthorized" },
              },
            },
          },
        },
      },
      BadRequest: {
        description: "Invalid request payload or validation error",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                error: { type: "string" },
                message: { type: "string" },
                validationError: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                message: { type: "string" },
                error: { type: "string" },
              },
            },
          },
        },
      },
      Forbidden: {
        description: "Request forbidden (e.g. invalid OAuth state)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean", example: false },
                message: { type: "string" },
                error: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type OpenApiDocument = typeof openApiDocument;
