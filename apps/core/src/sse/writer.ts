import type { RuntimeSseEvent, RuntimeSseEventName, RuntimeSseEventPayloadMap } from '@cwork/shared';

export interface SseSink {
  write(chunk: string): void;
  end(): void;
}

export interface SseWriterOptions {
  heartbeatMs?: number;
  setIntervalFn?: (callback: () => void, ms: number) => NodeJS.Timeout;
  clearIntervalFn?: (timer: NodeJS.Timeout) => void;
}

export class SseWriter {
  private readonly heartbeatMs: number;
  private readonly setIntervalFn: (callback: () => void, ms: number) => NodeJS.Timeout;
  private readonly clearIntervalFn: (timer: NodeJS.Timeout) => void;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(
    private readonly sink: SseSink,
    options: SseWriterOptions = {}
  ) {
    this.heartbeatMs = options.heartbeatMs ?? 15_000;
    this.setIntervalFn = options.setIntervalFn ?? setInterval;
    this.clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  }

  startHeartbeat(): void {
    if (this.closed || this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = this.setIntervalFn(() => {
      if (this.closed) {
        return;
      }
      this.sink.write(': heartbeat\n\n');
    }, this.heartbeatMs);
  }

  writeEvent<K extends RuntimeSseEventName>(event: K, data: RuntimeSseEventPayloadMap[K]): boolean {
    if (this.closed) {
      return false;
    }

    this.sink.write(`event: ${event}\n`);
    this.sink.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  }

  writeRuntimeEvent(event: RuntimeSseEvent): boolean {
    return this.writeEvent(event.event, event.data);
  }

  closeWithDone(): void {
    if (this.closed) {
      return;
    }
    this.writeEvent('done', { ok: true });
    this.close();
  }

  closeWithError(data: RuntimeSseEventPayloadMap['error']): void {
    if (this.closed) {
      return;
    }
    this.writeEvent('error', data);
    this.close();
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    if (this.heartbeatTimer) {
      this.clearIntervalFn(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.sink.end();
  }

  isClosed(): boolean {
    return this.closed;
  }
}
