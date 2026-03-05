import { isAbsolute, normalize, sep } from 'node:path';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';

export const assertSafeArchiveEntry = (entry: string): void => {
  const normalized = normalize(entry).replace(/\\/g, '/');
  if (!normalized || normalized === '.' || normalized === '/') {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `Invalid archive entry: ${entry}`);
  }

  if (isAbsolute(normalized) || normalized.startsWith('/') || normalized.includes('..')) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `Unsafe archive entry: ${entry}`);
  }
};

export const ensurePathInsideRoot = (rootDir: string, target: string): void => {
  const normalizedRoot = normalize(rootDir);
  const normalizedTarget = normalize(target);
  if (!normalizedTarget.startsWith(`${normalizedRoot}${sep}`) && normalizedTarget !== normalizedRoot) {
    throw new AppError(ERROR_CODE.VALIDATION_ERROR, `Target path escapes root: ${target}`);
  }
};
