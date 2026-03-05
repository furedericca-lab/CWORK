export interface AuditLogPayload {
  action: string;
  requestId: string;
  actor: string;
  result: 'success' | 'failure';
  details?: Record<string, unknown>;
}

export class AuditLogger {
  constructor(
    private readonly logger: {
      info(payload: Record<string, unknown>, message: string): void;
      error(payload: Record<string, unknown>, message: string): void;
    }
  ) {}

  log(payload: AuditLogPayload): void {
    const base = {
      audit: true,
      action: payload.action,
      requestId: payload.requestId,
      actor: payload.actor,
      result: payload.result,
      ...(payload.details ? { details: payload.details } : {})
    };

    if (payload.result === 'success') {
      this.logger.info(base, 'audit_log');
      return;
    }
    this.logger.error(base, 'audit_log');
  }
}
