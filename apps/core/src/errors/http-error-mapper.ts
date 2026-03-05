import { ZodError } from 'zod';
import type { ErrorEnvelope } from '@cwork/shared';
import { AppError } from './app-error';
import { ERROR_CODE, ERROR_CODE_STATUS } from './error-code';
import { redactSensitiveValue } from '../security/redact';

export interface HttpErrorMapping {
  statusCode: number;
  body: ErrorEnvelope;
}

export const mapErrorToHttp = (error: unknown, requestId: string): HttpErrorMapping => {
  if (error instanceof ZodError) {
    return {
      statusCode: ERROR_CODE_STATUS.VALIDATION_ERROR,
      body: {
        error: {
          code: ERROR_CODE.VALIDATION_ERROR,
          message: 'Validation failed',
          details: redactSensitiveValue(error.flatten()) as Record<string, unknown>,
          requestId
        }
      }
    };
  }

  if (error instanceof AppError) {
    const details = error.details ? (redactSensitiveValue(error.details) as Record<string, unknown>) : undefined;
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(details ? { details } : {})
        }
      }
    };
  }

  return {
    statusCode: ERROR_CODE_STATUS.INTERNAL_ERROR,
    body: {
      error: {
        code: ERROR_CODE.INTERNAL_ERROR,
        message: 'Internal server error',
        requestId
      }
    }
  };
};
