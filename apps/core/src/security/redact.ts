const SECRET_KEYWORD_PATTERN = /(token|secret|password|apikey|api_key|authorization|credential)/i;
const MASKED_VALUE = '***';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const redactSensitiveValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, current]) => {
    if (SECRET_KEYWORD_PATTERN.test(key)) {
      acc[key] = MASKED_VALUE;
      return acc;
    }

    acc[key] = redactSensitiveValue(current);
    return acc;
  }, {});
};
