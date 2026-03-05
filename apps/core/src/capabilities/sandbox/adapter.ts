import { execFile } from 'node:child_process';
import type { ToolDefinition, ToolExecutionContext } from '../../tools/types';
import { AppError } from '../../errors/app-error';
import { ERROR_CODE } from '../../errors/error-code';

export type RuntimeMode = 'none' | 'local' | 'sandbox';

export interface SandboxAdapterOptions {
  mode?: RuntimeMode;
  timeoutMs?: number;
  maxOutputBytes?: number;
  cpuSeconds?: number;
  memoryKb?: number;
  onAudit?: (payload: {
    action: string;
    requestId: string;
    sessionId?: string;
    result: 'success' | 'failure';
    details?: Record<string, unknown>;
  }) => void;
}

const limitString = (value: string, maxBytes: number): string => {
  const raw = Buffer.from(value);
  if (raw.length <= maxBytes) {
    return value;
  }
  return raw.subarray(0, maxBytes).toString('utf8');
};

const runExecFile = (command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });

export class SandboxAdapter {
  private readonly mode: RuntimeMode;
  private readonly timeoutMs: number;
  private readonly maxOutputBytes: number;
  private readonly cpuSeconds: number;
  private readonly memoryKb: number;

  constructor(private readonly options: SandboxAdapterOptions = {}) {
    this.mode = options.mode ?? 'none';
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 8_192;
    this.cpuSeconds = options.cpuSeconds ?? 3;
    this.memoryKb = options.memoryKb ?? 262_144;
  }

  getMode(): RuntimeMode {
    return this.mode;
  }

  health(): { enabled: boolean; healthy: boolean; lastError?: string } {
    if (this.mode === 'none') {
      return { enabled: false, healthy: true };
    }
    return { enabled: true, healthy: true };
  }

  buildTools(): ToolDefinition[] {
    if (this.mode !== 'sandbox') {
      return [];
    }

    return [
      {
        meta: {
          toolName: 'sandbox.exec',
          description: 'Execute shell command in sandbox runtime',
          enabled: true,
          source: 'builtin',
          schema: {
            command: { type: 'string', required: true }
          }
        },
        handler: async (args, ctx) => this.execCommand(String(args.command ?? ''), ctx)
      }
    ];
  }

  private async execCommand(command: string, ctx: ToolExecutionContext): Promise<{ stdout: string; stderr: string }> {
    if (this.mode !== 'sandbox') {
      throw new AppError(ERROR_CODE.FORBIDDEN, 'Sandbox execution requires runtime mode sandbox');
    }
    if (!command.trim()) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Sandbox command cannot be empty');
    }

    try {
      const guardedCommand = `ulimit -t ${this.cpuSeconds}; ulimit -v ${this.memoryKb}; ${command}`;
      const result = await runExecFile('bash', ['-lc', guardedCommand], this.timeoutMs);
      const output = {
        stdout: limitString(result.stdout, this.maxOutputBytes),
        stderr: limitString(result.stderr, this.maxOutputBytes)
      };
      this.options.onAudit?.({
        action: 'sandbox.exec',
        requestId: ctx.requestId,
        ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
        result: 'success',
        details: { command, cpuSeconds: this.cpuSeconds, memoryKb: this.memoryKb }
      });
      return output;
    } catch (error) {
      this.options.onAudit?.({
        action: 'sandbox.exec',
        requestId: ctx.requestId,
        ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
        result: 'failure',
        details: { command, reason: error instanceof Error ? error.message : String(error), cpuSeconds: this.cpuSeconds, memoryKb: this.memoryKb }
      });
      throw new AppError(ERROR_CODE.TIMEOUT, 'Sandbox execution failed', {
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
