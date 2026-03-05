# API Contracts (M0 Draft v2)

## 1. Purpose and Status
This document defines the contract-first API surface for v1 and the shared type draft used by both backend and frontend.

Status:
- Draft for M0 review.
- Contract-level only (implementation may be partial until milestones are complete).

Scope alignment:
- Dify is the only provider.
- No messaging platform APIs.
- API + WebUI are the only runtime entry points.

Contract source-of-truth:
- OpenAPI source: `packages/shared/openapi/openapi.yaml`
- Generated artifact: `packages/shared/src/generated/openapi.ts`
- Regeneration command: `pnpm --filter @cwork/shared gen:openapi`

## 2. Global Conventions

### 2.1 Base Path
- Base path: `/api/v1`

### 2.2 Content Types
- Request: `application/json`
- Streaming response: `text/event-stream`

### 2.3 Auth
- Header-based API key for management/runtime APIs.
- `Authorization: Bearer <token>`

### 2.4 Error Envelope (Non-SSE)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "difyApiKey is required",
    "details": {
      "field": "difyApiKey"
    },
    "requestId": "req_01HXYZ..."
  }
}
```

### 2.5 Standard Error Codes
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `VALIDATION_ERROR`
- `TIMEOUT`
- `UPSTREAM_ERROR`
- `INTERNAL_ERROR`

## 3. Runtime Chat and Streaming Contracts

### 3.1 POST `/runtime/chat`
Starts a pipeline run and returns SSE stream.

Request body:
```json
{
  "sessionId": "sess_001",
  "message": [
    { "type": "plain", "text": "Hello" }
  ],
  "enableStreaming": true,
  "configId": "default",
  "metadata": {
    "trace": true
  }
}
```

Fields:
- `sessionId` (string, optional): if omitted, server generates one.
- `message` (string or message-part array): user input payload.
- `enableStreaming` (boolean, default `true`).
- `configId` (string, optional).
- `metadata` (object, optional).

Message part schema (`message[]` item):
- `type`: `plain | image | file | video | reply | record`
- optional fields by type: `text`, `attachmentId`, `path`, `messageId`, `filename`

Response:
- `200` with `text/event-stream`

### 3.2 SSE Event Model
Event names and payloads:

1. `meta`
```json
{
  "requestId": "req_...",
  "sessionId": "sess_001",
  "timestamp": "2026-03-05T12:00:00Z"
}
```

2. `delta`
```json
{
  "text": "partial token stream",
  "index": 12
}
```

3. `tool_call_start`
```json
{
  "toolName": "web.search",
  "callId": "tool_001",
  "arguments": { "query": "..." }
}
```

4. `tool_call_end`
```json
{
  "toolName": "web.search",
  "callId": "tool_001",
  "ok": true,
  "result": { "summary": "..." }
}
```

5. `handoff`
```json
{
  "from": "main",
  "to": "research_subagent",
  "reason": "web research required"
}
```

6. `capability`
```json
{
  "type": "knowledge|search|mcp|sandbox",
  "status": "start|finish|error",
  "data": {}
}
```

7. `final_result`
```json
{
  "resultType": "llm_result|agent_runner_error",
  "messageChain": [
    { "type": "plain", "text": "final answer" }
  ],
  "usage": {
    "promptTokens": 100,
    "completionTokens": 40,
    "totalTokens": 140
  }
}
```

8. `error`
```json
{
  "code": "UPSTREAM_ERROR",
  "message": "Dify request failed",
  "retriable": true
}
```

9. `done`
```json
{
  "ok": true
}
```

## 4. Session and Run Metadata Contracts

### 4.1 GET `/runtime/sessions`
List chat sessions.

Query:
- `page` (default `1`)
- `pageSize` (default `20`)

Response:
```json
{
  "items": [
    {
      "sessionId": "sess_001",
      "displayName": "alice",
      "createdAt": "2026-03-05T12:00:00Z",
      "updatedAt": "2026-03-05T12:05:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

## 5. Dify Configuration Contracts

### 5.1 GET `/config/dify`
Returns effective Dify configuration.

Response:
```json
{
  "providerId": "dify_app_default",
  "difyApiBase": "https://api.dify.ai/v1",
  "difyApiType": "chat",
  "difyWorkflowOutputKey": "astrbot_wf_output",
  "difyQueryInputKey": "astrbot_text_query",
  "timeoutSec": 30,
  "variables": {},
  "masked": {
    "difyApiKey": "***"
  }
}
```

### 5.2 PUT `/config/dify`
Updates Dify configuration.

Request body:
```json
{
  "providerId": "dify_app_default",
  "difyApiKey": "${DIFY_API_KEY}",
  "difyApiBase": "https://api.dify.ai/v1",
  "difyApiType": "chatflow",
  "difyWorkflowOutputKey": "astrbot_wf_output",
  "difyQueryInputKey": "astrbot_text_query",
  "timeoutSec": 30,
  "variables": {
    "lang": "en"
  }
}
```

Validation rules:
- `difyApiKey` is required.
- `difyApiType` must be one of `chat | agent | chatflow | workflow`.
- `timeoutSec` must be a positive integer.

## 6. Plugin Management Contracts (Local Plugin First)

### 6.1 GET `/plugins`
List plugins and status.

Response:
```json
{
  "items": [
    {
      "pluginId": "example/hello-plugin",
      "name": "Hello Plugin",
      "version": "0.1.0",
      "status": "enabled",
      "source": "local|git",
      "error": null
    }
  ]
}
```

### 6.2 POST `/plugins/import/local`
Import/install plugin from local package path.

Request body:
```json
{
  "path": "/opt/plugins/hello-plugin"
}
```

### 6.3 POST `/plugins/import/git`
Import/install plugin from git repository.

Request body:
```json
{
  "repoUrl": "https://github.com/example/astrbot_plugin_xxx",
  "ref": "main"
}
```

### 6.4 POST `/plugins/{pluginId}/enable`
Enable plugin.

### 6.5 POST `/plugins/{pluginId}/disable`
Disable plugin.

### 6.6 POST `/plugins/{pluginId}/reload`
Hot-reload plugin.

### 6.7 DELETE `/plugins/{pluginId}`
Uninstall plugin.

Expected behavior across plugin endpoints:
- Failures are isolated.
- Runtime remains healthy even when plugin action fails.

## 7. Tool and Skill Contracts

### 7.1 GET `/tools`
List registered tools.

### 7.2 POST `/tools/execute`
Execute a tool for debugging (admin/debug mode).

Request body:
```json
{
  "toolName": "web.search",
  "arguments": {
    "query": "astrbot architecture"
  },
  "sessionId": "sess_001"
}
```

### 7.3 GET `/skills`
List loaded skills.

### 7.4 POST `/skills/reload`
Reload skills from configured skill paths.

### 7.5 POST `/skills/import`
Import a skill package (`.zip`) to local skill directory.

### 7.6 POST `/skills/{skillName}/enable`
Enable a skill.

### 7.7 POST `/skills/{skillName}/disable`
Disable a skill.

### 7.8 DELETE `/skills/{skillName}`
Delete a local skill.

## 8. SubAgent Contracts

### 8.1 GET `/subagents`
List subagent definitions.

### 8.2 PUT `/subagents`
Replace subagent definitions.

Request body:
```json
{
  "mainEnable": true,
  "removeMainDuplicateTools": false,
  "routerSystemPrompt": "You are a task router...",
  "agents": [
    {
      "name": "research_subagent",
      "enabled": true,
      "providerId": "dify_app_default",
      "systemPrompt": "Focus on research tasks",
      "publicDescription": "Handles web research",
      "tools": ["web.search", "kb.retrieve"]
    }
  ]
}
```

## 9. Proactive Task Contracts

### 9.1 GET `/proactive/jobs`
List scheduled proactive jobs.

### 9.2 POST `/proactive/jobs`
Create a proactive job.

Request body:
```json
{
  "name": "daily-briefing",
  "sessionId": "sess_001",
  "prompt": "Send my daily summary",
  "cronExpression": "0 9 * * *",
  "timezone": "Asia/Shanghai"
}
```

### 9.3 DELETE `/proactive/jobs/{jobId}`
Delete a proactive job.

## 10. Capability Status and Health Contracts

### 10.1 GET `/capabilities/status`
Returns status for `dify`, `plugins`, `skills`, `mcp`, `search`, `knowledge`, `sandbox`.

### 10.2 GET `/healthz`
Liveness check.

### 10.3 GET `/readyz`
Readiness check (Dify config, storage, and capability wiring).

## 11. Security and Logging Contract Notes
1. Never return raw secret values in API responses.
2. Never log raw API keys, auth headers, or secret environment values.
3. Error payloads must be redacted.
4. Sensitive actions (`plugins import`, config update) must emit audit logs with request ID and actor.

## 12. Versioning and Compatibility Policy
1. All breaking contract changes require version bump (`/api/v2` or explicit deprecation cycle).
2. Additive fields are allowed under the same version.
3. WebUI must consume APIs via typed shared contracts.

## 13. Shared Types Draft (OpenAPI + TypeScript)

### 13.1 OpenAPI Components Draft (YAML)
```yaml
openapi: 3.1.0
info:
  title: AstrBot Refactor API
  version: 0.1.0
components:
  schemas:
    ErrorEnvelope:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message, requestId]
          properties:
            code:
              type: string
              enum:
                - UNAUTHORIZED
                - FORBIDDEN
                - NOT_FOUND
                - CONFLICT
                - VALIDATION_ERROR
                - TIMEOUT
                - UPSTREAM_ERROR
                - INTERNAL_ERROR
            message:
              type: string
            details:
              type: object
              additionalProperties: true
            requestId:
              type: string

    MessagePart:
      oneOf:
        - $ref: '#/components/schemas/PlainPart'
        - $ref: '#/components/schemas/ImagePart'
        - $ref: '#/components/schemas/FilePart'
        - $ref: '#/components/schemas/VideoPart'
        - $ref: '#/components/schemas/ReplyPart'
        - $ref: '#/components/schemas/RecordPart'

    PlainPart:
      type: object
      required: [type, text]
      properties:
        type:
          type: string
          const: plain
        text:
          type: string

    ImagePart:
      type: object
      required: [type]
      properties:
        type:
          type: string
          const: image
        path:
          type: string
        url:
          type: string
        attachmentId:
          type: string

    FilePart:
      type: object
      required: [type]
      properties:
        type:
          type: string
          const: file
        path:
          type: string
        url:
          type: string
        attachmentId:
          type: string
        filename:
          type: string

    VideoPart:
      type: object
      required: [type]
      properties:
        type:
          type: string
          const: video
        path:
          type: string
        url:
          type: string
        attachmentId:
          type: string

    ReplyPart:
      type: object
      required: [type, messageId]
      properties:
        type:
          type: string
          const: reply
        messageId:
          oneOf:
            - type: string
            - type: integer

    RecordPart:
      type: object
      required: [type]
      properties:
        type:
          type: string
          const: record
        path:
          type: string
        url:
          type: string

    RuntimeChatRequest:
      type: object
      required: [message]
      properties:
        sessionId:
          type: string
        message:
          oneOf:
            - type: string
            - type: array
              items:
                $ref: '#/components/schemas/MessagePart'
        enableStreaming:
          type: boolean
          default: true
        configId:
          type: string
        metadata:
          type: object
          additionalProperties: true

    TokenUsage:
      type: object
      required: [promptTokens, completionTokens, totalTokens]
      properties:
        promptTokens:
          type: integer
          minimum: 0
        completionTokens:
          type: integer
          minimum: 0
        totalTokens:
          type: integer
          minimum: 0

    FinalResultEvent:
      type: object
      required: [resultType, messageChain]
      properties:
        resultType:
          type: string
          enum: [llm_result, agent_runner_error]
        messageChain:
          type: array
          items:
            $ref: '#/components/schemas/MessagePart'
        usage:
          $ref: '#/components/schemas/TokenUsage'

    DifyConfig:
      type: object
      required:
        - providerId
        - difyApiBase
        - difyApiType
        - difyWorkflowOutputKey
        - difyQueryInputKey
        - timeoutSec
      properties:
        providerId:
          type: string
        difyApiKey:
          type: string
          writeOnly: true
        difyApiBase:
          type: string
        difyApiType:
          type: string
          enum: [chat, agent, chatflow, workflow]
        difyWorkflowOutputKey:
          type: string
        difyQueryInputKey:
          type: string
        timeoutSec:
          type: integer
          minimum: 1
        variables:
          type: object
          additionalProperties: true

    PluginItem:
      type: object
      required: [pluginId, name, version, status, source]
      properties:
        pluginId:
          type: string
        name:
          type: string
        version:
          type: string
        status:
          type: string
          enum: [enabled, disabled, error]
        source:
          type: string
          enum: [local, git]
        error:
          type: string
          nullable: true

    SkillItem:
      type: object
      required: [name, path, active, sourceType]
      properties:
        name:
          type: string
        description:
          type: string
        path:
          type: string
        active:
          type: boolean
        sourceType:
          type: string
          enum: [local_only, sandbox_only, both]

    ProactiveJob:
      type: object
      required: [jobId, name, enabled, runOnce]
      properties:
        jobId:
          type: string
        name:
          type: string
        cronExpression:
          type: string
          nullable: true
        runOnce:
          type: boolean
        runAt:
          type: string
          format: date-time
          nullable: true
        timezone:
          type: string
          nullable: true
        enabled:
          type: boolean
        note:
          type: string
```

### 13.2 OpenAPI Path Snippet Draft (YAML)
```yaml
paths:
  /api/v1/runtime/chat:
    post:
      summary: Start chat runtime and stream SSE output
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RuntimeChatRequest'
      responses:
        '200':
          description: SSE stream
          content:
            text/event-stream:
              schema:
                type: string
        '400':
          description: Validation failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorEnvelope'
  /api/v1/config/dify:
    get:
      summary: Get Dify configuration
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DifyConfig'
    put:
      summary: Update Dify configuration
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/DifyConfig'
      responses:
        '200':
          description: Updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DifyConfig'
```

### 13.3 TypeScript Shared Type Draft
```ts
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "TIMEOUT"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export type MessagePart =
  | { type: "plain"; text: string }
  | { type: "image"; path?: string; url?: string; attachmentId?: string }
  | { type: "file"; path?: string; url?: string; attachmentId?: string; filename?: string }
  | { type: "video"; path?: string; url?: string; attachmentId?: string }
  | { type: "reply"; messageId: string | number }
  | { type: "record"; path?: string; url?: string };

export interface RuntimeChatRequest {
  sessionId?: string;
  message: string | MessagePart[];
  enableStreaming?: boolean;
  configId?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface FinalResultEvent {
  resultType: "llm_result" | "agent_runner_error";
  messageChain: MessagePart[];
  usage?: TokenUsage;
}

export interface DifyConfig {
  providerId: string;
  difyApiKey?: string;
  difyApiBase: string;
  difyApiType: "chat" | "agent" | "chatflow" | "workflow";
  difyWorkflowOutputKey: string;
  difyQueryInputKey: string;
  timeoutSec: number;
  variables?: Record<string, unknown>;
}

export interface PluginItem {
  pluginId: string;
  name: string;
  version: string;
  status: "enabled" | "disabled" | "error";
  source: "local" | "git";
  error?: string | null;
}

export interface SkillItem {
  name: string;
  description?: string;
  path: string;
  active: boolean;
  sourceType: "local_only" | "sandbox_only" | "both";
}

export interface SubAgentDefinition {
  name: string;
  enabled: boolean;
  providerId?: string | null;
  systemPrompt?: string;
  publicDescription?: string;
  tools?: string[];
  personaId?: string | null;
}

export interface SubAgentConfig {
  mainEnable: boolean;
  removeMainDuplicateTools: boolean;
  routerSystemPrompt?: string;
  agents: SubAgentDefinition[];
}

export interface ProactiveJob {
  jobId: string;
  name: string;
  cronExpression?: string | null;
  runOnce: boolean;
  runAt?: string | null;
  timezone?: string | null;
  enabled: boolean;
  note?: string;
}

export type SseEventType =
  | "meta"
  | "delta"
  | "tool_call_start"
  | "tool_call_end"
  | "handoff"
  | "capability"
  | "final_result"
  | "error"
  | "done";

export interface SseEvent<T = unknown> {
  event: SseEventType;
  data: T;
}
```

### 13.4 Runtime Schema Validation Draft (Zod)
```ts
import { z } from "zod";

export const messagePartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("plain"), text: z.string().min(1) }),
  z.object({ type: z.literal("image"), path: z.string().optional(), url: z.string().optional(), attachmentId: z.string().optional() }),
  z.object({ type: z.literal("file"), path: z.string().optional(), url: z.string().optional(), attachmentId: z.string().optional(), filename: z.string().optional() }),
  z.object({ type: z.literal("video"), path: z.string().optional(), url: z.string().optional(), attachmentId: z.string().optional() }),
  z.object({ type: z.literal("reply"), messageId: z.union([z.string(), z.number()]) }),
  z.object({ type: z.literal("record"), path: z.string().optional(), url: z.string().optional() })
]);

export const runtimeChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.union([z.string().min(1), z.array(messagePartSchema).min(1)]),
  enableStreaming: z.boolean().default(true),
  configId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const difyConfigSchema = z.object({
  providerId: z.string().min(1),
  difyApiKey: z.string().min(1).optional(),
  difyApiBase: z.string().url(),
  difyApiType: z.enum(["chat", "agent", "chatflow", "workflow"]),
  difyWorkflowOutputKey: z.string().min(1),
  difyQueryInputKey: z.string().min(1),
  timeoutSec: z.number().int().positive(),
  variables: z.record(z.unknown()).default({})
});
```

### 13.5 Shared Type Generation Workflow Draft
1. Keep OpenAPI schema under `packages/shared/openapi/openapi.yaml`.
2. Generate TypeScript API types with `openapi-typescript` to `packages/shared/src/generated/openapi.ts`.
3. Keep runtime validators in `packages/shared/src/schema/*.ts`.
4. Export stable contracts from `packages/shared/src/contracts/index.ts`.
5. Core and WebUI both import from `packages/shared` only.

---
Status: M0 contract and shared-type draft for review.
Date: 2026-03-05
