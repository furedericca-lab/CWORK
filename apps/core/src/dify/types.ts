export interface DifyStreamFrame {
  event?: string;
  conversation_id?: string;
  answer?: string;
  text?: string;
  delta?: string;
  message?: string;
  metadata?: {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  data?: {
    outputs?: Record<string, unknown>;
    files?: Array<Record<string, unknown>>;
  };
  code?: string;
}

export interface DifyChatStreamRequest {
  apiBase: string;
  apiKey: string;
  mode: 'chat' | 'agent' | 'chatflow';
  payload: Record<string, unknown>;
  timeoutSec: number;
}

export interface DifyWorkflowStreamRequest {
  apiBase: string;
  apiKey: string;
  payload: Record<string, unknown>;
  timeoutSec: number;
}

export interface DifyFileUploadRequest {
  apiBase: string;
  apiKey: string;
  filename: string;
  contentType: string;
  body: ArrayBuffer;
  timeoutSec: number;
}
