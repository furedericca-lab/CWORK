import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';

interface CronField {
  any: boolean;
  values: Set<number>;
}

export interface ParsedCronExpression {
  raw: string;
  hasSeconds: boolean;
  second: CronField;
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

interface RangeLimit {
  min: number;
  max: number;
}

const SECOND: RangeLimit = { min: 0, max: 59 };
const MINUTE: RangeLimit = { min: 0, max: 59 };
const HOUR: RangeLimit = { min: 0, max: 23 };
const DAY_OF_MONTH: RangeLimit = { min: 1, max: 31 };
const MONTH: RangeLimit = { min: 1, max: 12 };
const DAY_OF_WEEK: RangeLimit = { min: 0, max: 7 };

const zonedPartsFormatter = new Intl.DateTimeFormat('en-US', {
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC'
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: 'UTC'
});

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

const normalizeWeekday = (value: number): number => (value === 7 ? 0 : value);

const assertInRange = (value: number, limit: RangeLimit, label: string): void => {
  if (value < limit.min || value > limit.max) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `${label} value out of range: ${value}`);
  }
};

const parseNumber = (raw: string, limit: RangeLimit, label: string): number => {
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `${label} value must be an integer: ${raw}`);
  }
  assertInRange(value, limit, label);
  return value;
};

const parseSegment = (segment: string, limit: RangeLimit, label: string): number[] => {
  const stepSplit = segment.split('/');
  if (stepSplit.length > 2) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `${label} segment is invalid: ${segment}`);
  }

  const baseRaw = stepSplit[0]?.trim() ?? '';
  const stepRaw = stepSplit[1]?.trim();
  const step = stepRaw ? parseNumber(stepRaw, { min: 1, max: limit.max }, `${label} step`) : 1;

  if (!baseRaw || baseRaw === '*') {
    const result: number[] = [];
    for (let value = limit.min; value <= limit.max; value += step) {
      result.push(value);
    }
    return result;
  }

  const rangeSplit = baseRaw.split('-');
  if (rangeSplit.length > 2) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `${label} range is invalid: ${segment}`);
  }

  if (rangeSplit.length === 1) {
    const single = parseNumber(rangeSplit[0]!, limit, label);
    return [single];
  }

  const start = parseNumber(rangeSplit[0]!, limit, label);
  const end = parseNumber(rangeSplit[1]!, limit, label);
  if (start > end) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `${label} range start > end: ${segment}`);
  }

  const result: number[] = [];
  for (let value = start; value <= end; value += step) {
    result.push(value);
  }
  return result;
};

const parseCronField = (raw: string, limit: RangeLimit, label: string, normalize?: (value: number) => number): CronField => {
  const value = raw.trim();
  if (!value) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `${label} field cannot be empty`);
  }
  if (value === '*') {
    return { any: true, values: new Set<number>() };
  }

  const values = new Set<number>();
  const segments = value.split(',').map((item) => item.trim());
  for (const segment of segments) {
    if (!segment) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, `${label} segment cannot be empty`);
    }
    for (const parsed of parseSegment(segment, limit, label)) {
      values.add(normalize ? normalize(parsed) : parsed);
    }
  }

  return { any: false, values };
};

const toZonedDateParts = (
  date: Date,
  timezone: string
): { second: number; minute: number; hour: number; dayOfMonth: number; month: number; dayOfWeek: number } => {
  const partMap = new Map<string, string>();
  const parts = zonedPartsFormatter.formatToParts(date);
  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap.set(part.type, part.value);
    }
  }

  const year = Number(partMap.get('year'));
  const month = Number(partMap.get('month'));
  const dayOfMonth = Number(partMap.get('day'));
  const hour = Number(partMap.get('hour'));
  const minute = Number(partMap.get('minute'));
  const second = Number(partMap.get('second'));
  if ([year, month, dayOfMonth, hour, minute, second].some((value) => Number.isNaN(value))) {
    throw new AppError(ERROR_CODE.INTERNAL_ERROR, `Failed to parse zoned time parts for timezone: ${timezone}`);
  }

  const weekdayRaw = weekdayFormatter.format(new Date(Date.UTC(year, month - 1, dayOfMonth, hour, minute, second)));
  const dayOfWeek = WEEKDAY_MAP[weekdayRaw];
  if (dayOfWeek === undefined) {
    throw new AppError(ERROR_CODE.INTERNAL_ERROR, `Failed to parse weekday for timezone: ${timezone}`);
  }

  return {
    second,
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek
  };
};

const matchesField = (field: CronField, value: number): boolean => field.any || field.values.has(value);

export const parseCronExpression = (rawExpression: string): ParsedCronExpression => {
  const expression = rawExpression.trim();
  const parts = expression.split(/\s+/).filter(Boolean);
  if (parts.length !== 5 && parts.length !== 6) {
    throw new AppError(
      ERROR_CODE.VALIDATION_ERROR,
      `Unsupported cron expression format: ${rawExpression}. Expected 5 or 6 fields.`
    );
  }

  if (parts.length === 5) {
    const [minuteRaw, hourRaw, dayRaw, monthRaw, weekRaw] = parts;
    return {
      raw: rawExpression,
      hasSeconds: false,
      second: { any: true, values: new Set<number>() },
      minute: parseCronField(minuteRaw!, MINUTE, 'minute'),
      hour: parseCronField(hourRaw!, HOUR, 'hour'),
      dayOfMonth: parseCronField(dayRaw!, DAY_OF_MONTH, 'dayOfMonth'),
      month: parseCronField(monthRaw!, MONTH, 'month'),
      dayOfWeek: parseCronField(weekRaw!, DAY_OF_WEEK, 'dayOfWeek', normalizeWeekday)
    };
  }

  const [secondRaw, minuteRaw, hourRaw, dayRaw, monthRaw, weekRaw] = parts;
  return {
    raw: rawExpression,
    hasSeconds: true,
    second: parseCronField(secondRaw!, SECOND, 'second'),
    minute: parseCronField(minuteRaw!, MINUTE, 'minute'),
    hour: parseCronField(hourRaw!, HOUR, 'hour'),
    dayOfMonth: parseCronField(dayRaw!, DAY_OF_MONTH, 'dayOfMonth'),
    month: parseCronField(monthRaw!, MONTH, 'month'),
    dayOfWeek: parseCronField(weekRaw!, DAY_OF_WEEK, 'dayOfWeek', normalizeWeekday)
  };
};

export const cronTickMs = (expression: ParsedCronExpression): number => (expression.hasSeconds ? 1_000 : 60_000);

export const cronMatches = (expression: ParsedCronExpression, date: Date, timezone: string): boolean => {
  const zoned = toZonedDateParts(date, timezone);
  return (
    matchesField(expression.second, zoned.second) &&
    matchesField(expression.minute, zoned.minute) &&
    matchesField(expression.hour, zoned.hour) &&
    matchesField(expression.dayOfMonth, zoned.dayOfMonth) &&
    matchesField(expression.month, zoned.month) &&
    matchesField(expression.dayOfWeek, zoned.dayOfWeek)
  );
};
