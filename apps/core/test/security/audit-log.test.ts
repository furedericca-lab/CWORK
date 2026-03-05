import { describe, expect, it, vi } from 'vitest';
import { AuditLogger } from '../../src/security/audit-log';

describe('AuditLogger', () => {
  it('writes success and failure audit entries', () => {
    const info = vi.fn();
    const error = vi.fn();
    const logger = new AuditLogger({ info, error });

    logger.log({
      action: 'plugin.import.local',
      requestId: 'req_1',
      actor: 'api',
      result: 'success'
    });
    logger.log({
      action: 'plugin.import.git',
      requestId: 'req_2',
      actor: 'api',
      result: 'failure',
      details: { reason: 'boom' }
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
