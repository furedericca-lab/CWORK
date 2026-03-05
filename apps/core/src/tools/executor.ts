import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import { PermissionPolicy } from '../policy/permissions';
import { redactSensitiveValue } from '../security/redact';
import { ToolRegistry } from './registry';
import type { ToolExecutionContext, ToolExecutionResult, ToolTraceHooks } from './types';
import { validateToolArguments } from './types';

export interface ToolExecutorOptions {
  timeoutMs?: number;
  policy?: PermissionPolicy;
  logger?: {
    info(payload: Record<string, unknown>, message: string): void;
    error(payload: Record<string, unknown>, message: string): void;
  };
}

export class ToolExecutor {
  private readonly timeoutMs: number;
  private readonly policy: PermissionPolicy;

  constructor(
    private readonly registry: ToolRegistry,
    private readonly options: ToolExecutorOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.policy = options.policy ?? new PermissionPolicy();
  }

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ToolExecutionContext,
    hooks?: ToolTraceHooks
  ): Promise<ToolExecutionResult> {
    const callId = `tool_${randomUUID()}`;
    hooks?.onStart?.({ toolName, callId, arguments: args });

    try {
      this.policy.assertToolAllowed(toolName);

      const found = await this.registry.get(toolName);
      if (!found) {
        throw new AppError(ERROR_CODE.NOT_FOUND, `Tool not found: ${toolName}`);
      }

      if (!found.enabled) {
        throw new AppError(ERROR_CODE.FORBIDDEN, `Tool is disabled: ${toolName}`);
      }

      const validation = validateToolArguments(found.schema, args);
      if (!validation.valid) {
        throw new AppError(ERROR_CODE.VALIDATION_ERROR, validation.message ?? 'Invalid tool arguments');
      }

      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AppError(ERROR_CODE.TIMEOUT, `Tool execution timed out: ${toolName}`)), this.timeoutMs);
      });

      const executionPromise = Promise.resolve().then(() => found.handler(args, ctx));
      const output = await Promise.race([executionPromise, timeoutPromise]).finally(() => {
        if (timer) {
          clearTimeout(timer);
        }
      });

      const result = { ok: true, output };
      hooks?.onEnd?.({
        toolName,
        callId,
        ok: true,
        result: { output: redactSensitiveValue(output) }
      });

      this.options.logger?.info(
        {
          requestId: ctx.requestId,
          sessionId: ctx.sessionId,
          toolName,
          callId
        },
        'tool_execution_succeeded'
      );

      return result;
    } catch (error) {
      const mapped =
        error instanceof AppError
          ? error
          : new AppError(ERROR_CODE.INTERNAL_ERROR, 'Tool execution failed', {
              reason: error instanceof Error ? error.message : String(error)
            });

      hooks?.onEnd?.({
        toolName,
        callId,
        ok: false,
        result: {
          code: mapped.code,
          message: mapped.message
        }
      });

      this.options.logger?.error(
        {
          requestId: ctx.requestId,
          sessionId: ctx.sessionId,
          toolName,
          callId,
          code: mapped.code,
          message: mapped.message
        },
        'tool_execution_failed'
      );

      return {
        ok: false,
        error: {
          code: mapped.code,
          message: mapped.message
        }
      };
    }
  }
}
