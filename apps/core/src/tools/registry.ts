import type { ToolItem } from '@cwork/shared';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import type { ToolRepository } from '../repo/interfaces';
import type { ToolDefinition } from './types';

export class ToolRegistry {
  private readonly handlers = new Map<string, ToolDefinition['handler']>();

  constructor(private readonly repository: ToolRepository) {}

  async register(definition: ToolDefinition): Promise<void> {
    await this.repository.upsert(definition.meta);
    this.handlers.set(definition.meta.toolName, definition.handler);
  }

  async remove(toolName: string): Promise<void> {
    await this.repository.delete(toolName);
    this.handlers.delete(toolName);
  }

  async list(): Promise<ToolItem[]> {
    return this.repository.list();
  }

  async toggle(toolName: string, enabled: boolean): Promise<ToolItem> {
    const found = await this.repository.get(toolName);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Tool not found: ${toolName}`);
    }

    const next = {
      ...found,
      enabled
    };
    await this.repository.upsert(next);
    return next;
  }

  async get(toolName: string): Promise<(ToolItem & { handler: ToolDefinition['handler'] }) | null> {
    const meta = await this.repository.get(toolName);
    const handler = this.handlers.get(toolName);
    if (!meta || !handler) {
      return null;
    }

    return {
      ...meta,
      handler
    };
  }
}
