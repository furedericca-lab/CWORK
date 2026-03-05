import type { ToolDefinition } from './types';
import { ToolRegistry } from './registry';
import { McpRuntimeManager } from '../mcp/runtime-manager';
import { KnowledgeManager } from '../capabilities/knowledge/manager';
import { WebSearchAdapter } from '../capabilities/search/adapter';
import { SandboxAdapter } from '../capabilities/sandbox/adapter';

export const createBuiltinTools = (deps: {
  mcpManager: McpRuntimeManager;
  searchAdapter: WebSearchAdapter;
  knowledgeManager: KnowledgeManager;
  sandboxAdapter: SandboxAdapter;
}): ToolDefinition[] => {
  const baseTools: ToolDefinition[] = [
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
        return deps.mcpManager.listServers();
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
        return deps.mcpManager.testServer(String(args.name ?? ''));
      }
    },
    {
      meta: {
        toolName: 'web.search',
        description: 'Search web results with configured search provider',
        enabled: true,
        source: 'builtin',
        schema: {
          query: { type: 'string', required: true }
        }
      },
      async handler(args) {
        return deps.searchAdapter.search(String(args.query ?? ''));
      }
    },
    {
      meta: {
        toolName: 'kb.retrieve',
        description: 'Retrieve relevant entries from knowledge base',
        enabled: true,
        source: 'builtin',
        schema: {
          query: { type: 'string', required: true },
          topK: { type: 'number', required: false }
        }
      },
      async handler(args) {
        return deps.knowledgeManager.retrieve({
          query: String(args.query ?? ''),
          ...(typeof args.topK === 'number' ? { topK: args.topK } : {})
        });
      }
    }
  ];

  return [...baseTools, ...deps.sandboxAdapter.buildTools()];
};

export const registerBuiltinTools = async (
  registry: ToolRegistry,
  deps: {
    mcpManager: McpRuntimeManager;
    searchAdapter: WebSearchAdapter;
    knowledgeManager: KnowledgeManager;
    sandboxAdapter: SandboxAdapter;
  }
): Promise<void> => {
  const tools = createBuiltinTools(deps);
  for (const tool of tools) {
    await registry.register(tool);
  }
};
