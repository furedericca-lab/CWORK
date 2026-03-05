import { difyConfigSchema, type DifyConfig, type DifyConfigMaskedView } from '@cwork/shared';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import type { DifyConfigRepository } from '../repo/interfaces';

const resolveEnvTemplate = (value: string): string => {
  const match = value.match(/^\$\{([A-Z0-9_]+)\}$/i);
  const key = match?.[1];
  if (!key) {
    return value;
  }

  return process.env[key] ?? '';
};

export class DifyConfigService {
  constructor(private readonly repository: DifyConfigRepository) {}

  async getConfig(): Promise<DifyConfig> {
    return difyConfigSchema.parse(await this.repository.get());
  }

  async getMaskedConfig(): Promise<DifyConfigMaskedView> {
    const config = await this.getConfig();
    return {
      ...config,
      masked: {
        difyApiKey: config.difyApiKey ? '***' : ''
      }
    };
  }

  async updateConfig(input: unknown): Promise<DifyConfigMaskedView> {
    const parsed = difyConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid dify config payload', parsed.error.flatten());
    }

    const current = await this.getConfig();
    const nextApiKey = parsed.data.difyApiKey ?? current.difyApiKey;
    if (!nextApiKey) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'difyApiKey is required');
    }

    const nextConfig: DifyConfig = {
      providerId: parsed.data.providerId,
      difyApiKey: nextApiKey,
      difyApiBase: parsed.data.difyApiBase,
      difyApiType: parsed.data.difyApiType,
      difyWorkflowOutputKey: parsed.data.difyWorkflowOutputKey,
      difyQueryInputKey: parsed.data.difyQueryInputKey,
      timeoutSec: parsed.data.timeoutSec,
      variables: parsed.data.variables
    };

    await this.repository.set(nextConfig);
    return this.getMaskedConfig();
  }

  async getResolvedApiKey(): Promise<string> {
    const config = await this.getConfig();
    const raw = config.difyApiKey;
    if (!raw) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'difyApiKey is required');
    }

    const resolved = resolveEnvTemplate(raw);
    if (!resolved) {
      throw new AppError(ERROR_CODE.UNAUTHORIZED, 'Resolved difyApiKey is empty');
    }

    return resolved;
  }
}
