import type { ErrorCode } from './error-code';
import { ERROR_CODE_STATUS } from './error-code';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>, statusCode?: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode ?? ERROR_CODE_STATUS[code];
    this.details = details;
  }
}
