import type { FastifyRequest } from 'fastify';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';

export interface AuthOptions {
  token: string;
}

const normalizeAuthorization = (request: FastifyRequest): string | undefined => {
  const value = request.headers.authorization;
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export const verifyBearerToken = (request: FastifyRequest, options: AuthOptions) => {
  const authorization = normalizeAuthorization(request);
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new AppError(ERROR_CODE.UNAUTHORIZED, 'Missing bearer token');
  }

  const actualToken = authorization.slice('Bearer '.length).trim();
  if (actualToken.length === 0 || actualToken !== options.token) {
    throw new AppError(ERROR_CODE.UNAUTHORIZED, 'Invalid bearer token');
  }
};
