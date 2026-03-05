import type { ToolExecuteRequestInput, ToolItem, ToolSchemaField } from '@cwork/shared';

export interface ToolExecutionContext {
  requestId: string;
  sessionId?: string;
}

export interface ToolExecutionResult {
  ok: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface ToolDefinition {
  meta: ToolItem;
  handler: (args: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<unknown> | unknown;
}

export interface ToolTraceHooks {
  onStart?: (payload: { toolName: string; callId: string; arguments: Record<string, unknown> }) => void;
  onEnd?: (payload: { toolName: string; callId: string; ok: boolean; result?: Record<string, unknown> }) => void;
}

export const validateToolArguments = (
  schema: Record<string, ToolSchemaField>,
  args: Record<string, unknown>
): { valid: boolean; message?: string } => {
  for (const [key, field] of Object.entries(schema)) {
    if (field.required && !(key in args)) {
      return { valid: false, message: `Missing required field: ${key}` };
    }

    if (!(key in args)) {
      continue;
    }

    const value = args[key];
    if (field.type === 'array' && !Array.isArray(value)) {
      return { valid: false, message: `Field ${key} must be array` };
    }

    if (field.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
      return { valid: false, message: `Field ${key} must be object` };
    }

    if (field.type !== 'array' && field.type !== 'object' && typeof value !== field.type) {
      return { valid: false, message: `Field ${key} must be ${field.type}` };
    }
  }

  return { valid: true };
};

export const toToolExecutionRequest = (input: ToolExecuteRequestInput): Required<ToolExecuteRequestInput> => ({
  toolName: input.toolName,
  arguments: input.arguments,
  sessionId: input.sessionId ?? ''
});
