import type { ToolDefinition } from './types';
import { ToolRegistry } from './registry';
import { McpRuntimeManager } from '../mcp/runtime-manager';

export const createBuiltinTools = (mcpManager: McpRuntimeManager): ToolDefinition[] => [
  {
    meta: {
      toolName: 'tool.echo',
      description: 'Echo back input string',
      enabled: true,
      source: 'builtin',
      schema: {
        text: { type: 'string', required: true }
      }
    },
    handler(args) {
      return {
        text: args.text
      };
    }
  },
  {
    meta: {
      toolName: 'mcp.list_servers',
      description: 'List MCP servers and runtime states',
      enabled: true,
      source: 'mcp',
      schema: {}
    },
    async handler() {
      return mcpManager.listServers();
    }
  },
  {
    meta: {
      toolName: 'mcp.test_server',
      description: 'Run health test for a specific MCP server',
      enabled: true,
      source: 'mcp',
      schema: {
        name: { type: 'string', required: true }
      }
    },
    async handler(args) {
      return mcpManager.testServer(String(args.name ?? ''));
    }
  }
];

export const registerBuiltinTools = async (registry: ToolRegistry, mcpManager: McpRuntimeManager): Promise<void> => {
  const tools = createBuiltinTools(mcpManager);
  for (const tool of tools) {
    await registry.register(tool);
  }
};
