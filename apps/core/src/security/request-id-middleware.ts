import { randomUUID } from 'node:crypto';

const REQUEST_ID_HEADER = 'x-request-id';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

const getHeaderRequestId = (request: RequestLike): string | undefined => {
  const value = request.headers[REQUEST_ID_HEADER];
  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return undefined;
};

export const genRequestId = (request: RequestLike): string => getHeaderRequestId(request) ?? `req_${randomUUID()}`;

export const applyRequestIdHeader = (requestId: string, replyHeader: (name: string, value: string) => void) => {
  replyHeader(REQUEST_ID_HEADER, requestId);
};
