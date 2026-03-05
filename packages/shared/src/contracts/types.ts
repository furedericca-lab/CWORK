export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export type MessagePart =
  | { type: 'plain'; text: string }
  | { type: 'image'; path?: string; url?: string; attachmentId?: string }
  | { type: 'file'; path?: string; url?: string; attachmentId?: string; filename?: string }
  | { type: 'video'; path?: string; url?: string; attachmentId?: string }
  | { type: 'reply'; messageId: string | number }
  | { type: 'record'; path?: string; url?: string };

export interface RuntimeChatRequest {
  sessionId?: string;
  message: string | MessagePart[];
  enableStreaming?: boolean;
  configId?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeSessionItem {
  sessionId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DifyConfig {
  providerId: string;
  difyApiKey?: string;
  difyApiBase: string;
  difyApiType: 'chat' | 'agent' | 'chatflow' | 'workflow';
  difyWorkflowOutputKey: string;
  difyQueryInputKey: string;
  timeoutSec: number;
  variables?: Record<string, unknown>;
}
