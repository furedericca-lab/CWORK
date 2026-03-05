import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../src/errors/app-error';
import { ERROR_CODE } from '../src/errors/error-code';
import { mapErrorToHttp } from '../src/errors/http-error-mapper';

describe('mapErrorToHttp', () => {
  it('maps known app errors to fixed status code and envelope', () => {
    const error = new AppError(ERROR_CODE.TIMEOUT, 'provider timeout', {
      apiKey: 'secret',
      nested: { token: 'sensitive' }
    });

    const mapped = mapErrorToHttp(error, 'req_x');

    expect(mapped.statusCode).toBe(504);
    expect(mapped.body).toEqual({
      error: {
        code: 'TIMEOUT',
        message: 'provider timeout',
        details: {
          apiKey: '***',
          nested: { token: '***' }
        },
        requestId: 'req_x'
      }
    });
  });

  it('maps zod errors to validation envelope', () => {
    const result = z.object({ count: z.number().int().min(1) }).safeParse({ count: 0 });
    if (result.success) {
      throw new Error('Expected zod parse to fail');
    }

    const mapped = mapErrorToHttp(result.error, 'req_validation');

    expect(mapped.statusCode).toBe(400);
    expect(mapped.body.error.code).toBe('VALIDATION_ERROR');
    expect(mapped.body.error.requestId).toBe('req_validation');
  });

  it('maps unknown errors to internal envelope', () => {
    const mapped = mapErrorToHttp(new Error('unexpected'), 'req_internal');

    expect(mapped.statusCode).toBe(500);
    expect(mapped.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: 'req_internal'
      }
    });
  });
});
