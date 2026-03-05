import type { McpServerConfig, McpServerRuntimeState } from '@cwork/shared';
import { mcpServerConfigSchema } from '@cwork/shared';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import type { McpRepository } from '../repo/interfaces';

const nowIso = () => new Date().toISOString();

export class McpRuntimeManager {
  constructor(private readonly repository: McpRepository) {}

  async listServers(): Promise<Array<McpServerConfig & { runtime: McpServerRuntimeState }>> {
    const items = await this.repository.list();
    const result: Array<McpServerConfig & { runtime: McpServerRuntimeState }> = [];

    for (const item of items) {
      const runtime = (await this.repository.getRuntimeState(item.name)) ?? {
        name: item.name,
        enabled: item.enabled,
        healthy: false
      };

      result.push({
        ...item,
        runtime
      });
    }

    return result;
  }

  async addServer(input: unknown): Promise<McpServerConfig> {
    const parsed = mcpServerConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid MCP server config', parsed.error.flatten());
    }

    const exists = await this.repository.get(parsed.data.name);
    if (exists) {
      throw new AppError(ERROR_CODE.CONFLICT, `MCP server already exists: ${parsed.data.name}`);
    }

    await this.repository.upsert(parsed.data);
    await this.repository.setRuntimeState(parsed.data.name, {
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      healthy: false,
      lastCheckAt: nowIso()
    });

    return parsed.data;
  }

  async updateServer(input: unknown): Promise<McpServerConfig> {
    const parsed = mcpServerConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid MCP server config', parsed.error.flatten());
    }

    const exists = await this.repository.get(parsed.data.name);
    if (!exists) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `MCP server not found: ${parsed.data.name}`);
    }

    await this.repository.upsert(parsed.data);
    await this.repository.setRuntimeState(parsed.data.name, {
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      healthy: false,
      lastCheckAt: nowIso()
    });

    return parsed.data;
  }

  async deleteServer(name: string): Promise<void> {
    const exists = await this.repository.get(name);
    if (!exists) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `MCP server not found: ${name}`);
    }

    await this.repository.delete(name);
  }

  async enableServer(name: string): Promise<void> {
    const found = await this.repository.get(name);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `MCP server not found: ${name}`);
    }

    const next = {
      ...found,
      enabled: true
    };
    await this.repository.upsert(next);
    await this.repository.setRuntimeState(name, {
      name,
      enabled: true,
      healthy: false,
      lastCheckAt: nowIso()
    });
  }

  async disableServer(name: string): Promise<void> {
    const found = await this.repository.get(name);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `MCP server not found: ${name}`);
    }

    const next = {
      ...found,
      enabled: false
    };
    await this.repository.upsert(next);
    await this.repository.setRuntimeState(name, {
      name,
      enabled: false,
      healthy: false,
      lastCheckAt: nowIso()
    });
  }

  async testServer(name: string): Promise<McpServerRuntimeState> {
    const found = await this.repository.get(name);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `MCP server not found: ${name}`);
    }

    let healthy = false;
    let error: string | undefined;

    try {
      if (found.transport === 'stdio') {
        healthy = !!found.command;
      } else if (found.url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), (found.timeoutSec ?? 15) * 1000);
        try {
          const response = await fetch(found.url, {
            method: 'GET',
            signal: controller.signal
          });
          healthy = response.ok;
          if (!response.ok) {
            error = `HTTP ${response.status}`;
          }
        } finally {
          clearTimeout(timeout);
        }
      }
    } catch (err) {
      healthy = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const state: McpServerRuntimeState = {
      name,
      enabled: found.enabled,
      healthy,
      lastCheckAt: nowIso(),
      ...(error ? { lastError: error } : {})
    };

    await this.repository.setRuntimeState(name, state);
    return state;
  }

  async shutdown(): Promise<void> {
    const servers = await this.repository.list();
    await Promise.all(
      servers.map((server) =>
        this.repository.setRuntimeState(server.name, {
          name: server.name,
          enabled: server.enabled,
          healthy: false,
          lastCheckAt: nowIso(),
          lastError: 'shutdown'
        })
      )
    );
  }
}
