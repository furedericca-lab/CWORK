import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';

export interface PermissionPolicyConfig {
  allowTools?: string[];
  denyTools?: string[];
  denyPluginCapabilities?: string[];
}

export class PermissionPolicy {
  private readonly allowTools: Set<string> | undefined;
  private readonly denyTools: Set<string>;
  private readonly denyPluginCapabilities: Set<string>;

  constructor(config: PermissionPolicyConfig = {}) {
    this.allowTools = config.allowTools ? new Set(config.allowTools) : undefined;
    this.denyTools = new Set(config.denyTools ?? []);
    this.denyPluginCapabilities = new Set(config.denyPluginCapabilities ?? []);
  }

  assertToolAllowed(toolName: string): void {
    if (this.denyTools.has(toolName)) {
      throw new AppError(ERROR_CODE.FORBIDDEN, `Tool is denied by policy: ${toolName}`);
    }

    if (this.allowTools && !this.allowTools.has(toolName)) {
      throw new AppError(ERROR_CODE.FORBIDDEN, `Tool is not in allowlist: ${toolName}`);
    }
  }

  assertPluginCapabilities(capabilities: string[]): void {
    const denied = capabilities.filter((capability) => this.denyPluginCapabilities.has(capability));
    if (denied.length > 0) {
      throw new AppError(ERROR_CODE.FORBIDDEN, `Plugin capability denied: ${denied.join(', ')}`);
    }
  }
}
