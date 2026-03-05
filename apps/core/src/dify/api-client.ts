import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import { parseDifySseStream } from './stream-parser';
import type { DifyChatStreamRequest, DifyFileUploadRequest, DifyStreamFrame, DifyWorkflowStreamRequest } from './types';

interface DifyApiClientOptions {
  fetcher?: typeof fetch;
  retries?: number;
}

const buildHeaders = (apiKey: string): HeadersInit => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
});

const joinUrl = (base: string, path: string): string => {
  if (base.endsWith('/')) {
    return `${base.slice(0, -1)}${path}`;
  }
  return `${base}${path}`;
};

export class DifyApiClient {
  private readonly fetcher: typeof fetch;
  private readonly retries: number;

  constructor(options: DifyApiClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.retries = options.retries ?? 1;
  }

  async *chatMessagesStream(request: DifyChatStreamRequest): AsyncGenerator<DifyStreamFrame, void, void> {
    const response = await this.streamRequest({
      url: joinUrl(request.apiBase, '/chat-messages'),
      apiKey: request.apiKey,
      payload: {
        response_mode: 'streaming',
        ...request.payload
      },
      timeoutSec: request.timeoutSec
    });

    for await (const frame of parseDifySseStream(response.body)) {
      yield frame;
    }
  }

  async *workflowRunStream(request: DifyWorkflowStreamRequest): AsyncGenerator<DifyStreamFrame, void, void> {
    const response = await this.streamRequest({
      url: joinUrl(request.apiBase, '/workflows/run'),
      apiKey: request.apiKey,
      payload: {
        response_mode: 'streaming',
        ...request.payload
      },
      timeoutSec: request.timeoutSec
    });

    for await (const frame of parseDifySseStream(response.body)) {
      yield frame;
    }
  }

  async fileUpload(request: DifyFileUploadRequest): Promise<{ id: string }> {
    const formData = new FormData();
    const blob = new Blob([request.body], { type: request.contentType });
    formData.set('file', blob, request.filename);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutSec * 1000);

    try {
      const response = await this.fetcher(joinUrl(request.apiBase, '/files/upload'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${request.apiKey}`
        },
        body: formData,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new AppError(ERROR_CODE.UPSTREAM_ERROR, `Dify file upload failed with status ${response.status}`);
      }

      return (await response.json()) as { id: string };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(ERROR_CODE.UPSTREAM_ERROR, 'Dify file upload request failed', {
        reason: error instanceof Error ? error.message : String(error)
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async streamRequest(params: {
    url: string;
    apiKey: string;
    payload: Record<string, unknown>;
    timeoutSec: number;
  }): Promise<{ body: ReadableStream<Uint8Array> }> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), params.timeoutSec * 1000);

      try {
        const response = await this.fetcher(params.url, {
          method: 'POST',
          headers: buildHeaders(params.apiKey),
          body: JSON.stringify(params.payload),
          signal: controller.signal
        });

        if (!response.ok) {
          const shouldRetry = response.status >= 500 && attempt < this.retries;
          if (shouldRetry) {
            continue;
          }

          throw new AppError(ERROR_CODE.UPSTREAM_ERROR, `Dify request failed with status ${response.status}`);
        }

        if (!response.body) {
          throw new AppError(ERROR_CODE.UPSTREAM_ERROR, 'Dify stream body is empty');
        }

        return { body: response.body };
      } catch (error) {
        lastError = error;

        if (error instanceof AppError) {
          if (error.code !== ERROR_CODE.UPSTREAM_ERROR || attempt >= this.retries) {
            throw error;
          }
          continue;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          if (attempt >= this.retries) {
            throw new AppError(ERROR_CODE.TIMEOUT, 'Dify request timed out');
          }
          continue;
        }

        if (attempt >= this.retries) {
          throw new AppError(ERROR_CODE.UPSTREAM_ERROR, 'Dify request failed', {
            reason: error instanceof Error ? error.message : String(error)
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new AppError(ERROR_CODE.UPSTREAM_ERROR, 'Dify request failed', {
      reason: lastError instanceof Error ? lastError.message : String(lastError)
    });
  }
}
