export interface RuntimeBusEvent<TPayload = unknown> {
  type: string;
  payload: TPayload;
  timestamp: string;
}

export type RuntimeBusListener<TPayload = unknown> = (event: RuntimeBusEvent<TPayload>) => void;

export class RuntimeEventBus {
  private readonly listeners = new Map<string, Set<RuntimeBusListener>>();

  subscribe<TPayload = unknown>(type: string, listener: RuntimeBusListener<TPayload>): () => void {
    const set = this.listeners.get(type) ?? new Set<RuntimeBusListener>();
    set.add(listener as RuntimeBusListener);
    this.listeners.set(type, set);

    return () => {
      const existing = this.listeners.get(type);
      existing?.delete(listener as RuntimeBusListener);
      if (existing && existing.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  publish<TPayload = unknown>(type: string, payload: TPayload): void {
    const event: RuntimeBusEvent<TPayload> = {
      type,
      payload,
      timestamp: new Date().toISOString()
    };

    const set = this.listeners.get(type);
    if (!set) {
      return;
    }

    for (const listener of set) {
      listener(event);
    }
  }
}
