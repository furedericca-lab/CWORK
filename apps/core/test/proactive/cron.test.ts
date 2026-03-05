import { describe, expect, it } from 'vitest';
import { cronMatches, cronTickMs, parseCronExpression } from '../../src/proactive/cron';

describe('proactive cron utilities', () => {
  it('parses 5-field cron and uses minute-level tick', () => {
    const parsed = parseCronExpression('0 9 * * *');
    expect(parsed.hasSeconds).toBe(false);
    expect(cronTickMs(parsed)).toBe(60_000);
  });

  it('parses 6-field cron and uses second-level tick', () => {
    const parsed = parseCronExpression('*/10 * * * * *');
    expect(parsed.hasSeconds).toBe(true);
    expect(cronTickMs(parsed)).toBe(1_000);
  });

  it('matches 5-field cron by timezone', () => {
    const parsed = parseCronExpression('0 9 * * *');
    const matched = cronMatches(parsed, new Date('2026-03-05T09:00:00Z'), 'UTC');
    const notMatched = cronMatches(parsed, new Date('2026-03-05T09:01:00Z'), 'UTC');
    expect(matched).toBe(true);
    expect(notMatched).toBe(false);
  });

  it('rejects unsupported cron format', () => {
    expect(() => parseCronExpression('0 9 * *')).toThrow(/Expected 5 or 6 fields/);
  });
});
