import type { MessagePart, RuntimeChatRequestInput, SubagentConfig, SubagentDescriptor } from '@cwork/shared';
import { subagentConfigSchema } from '@cwork/shared';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import type { SubagentConfigRepository, SubagentRepository } from '../repo/interfaces';
import { ToolRegistry } from '../tools/registry';

const HANDOFF_TOOL_PREFIX = 'handoff.';
const DEFAULT_ROUTER_PROMPT = 'Route to a specialized subagent when it improves answer quality.';
const MAX_HANDOFF_DEPTH = 3;

const normalizeSubagentToolName = (subagentId: string): string => `${HANDOFF_TOOL_PREFIX}${subagentId}`;

export class SubagentOrchestrator {
  private readonly registeredHandoffTools = new Set<string>();

  constructor(
    private readonly repository: SubagentRepository,
    private readonly configRepository: SubagentConfigRepository,
    private readonly toolRegistry: ToolRegistry
  ) {}

  async initialize(): Promise<void> {
    await this.syncFromConfig(await this.getConfig());
    await this.reregisterHandoffTools();
  }

  async getConfig(): Promise<SubagentConfig> {
    const config = await this.configRepository.get();
    return {
      mainEnable: config.mainEnable,
      removeMainDuplicateTools: config.removeMainDuplicateTools,
      routerSystemPrompt: config.routerSystemPrompt ?? DEFAULT_ROUTER_PROMPT,
      agents: config.agents ?? []
    };
  }

  async updateConfig(input: unknown): Promise<SubagentConfig> {
    const parsed = subagentConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid subagent config payload', parsed.error.flatten());
    }

    const next: SubagentConfig = {
      mainEnable: parsed.data.mainEnable,
      removeMainDuplicateTools: parsed.data.removeMainDuplicateTools,
      ...(parsed.data.routerSystemPrompt ? { routerSystemPrompt: parsed.data.routerSystemPrompt } : {}),
      agents: parsed.data.agents.map((agent) => ({ ...agent }))
    };

    await this.configRepository.set(next);
    await this.syncFromConfig(next);
    await this.reregisterHandoffTools();
    return this.getConfig();
  }

  async listAgents(): Promise<SubagentDescriptor[]> {
    return this.repository.list();
  }

  async listAvailableTools(): Promise<Awaited<ReturnType<ToolRegistry['list']>>> {
    return this.toolRegistry.list();
  }

  async resolveHandoff(
    request: RuntimeChatRequestInput,
    normalizedMessage: MessagePart[]
  ): Promise<{ from: string; to: string; reason: string } | null> {
    const config = await this.getConfig();
    if (!config.mainEnable) {
      return null;
    }

    const depthRaw = request.metadata?.handoffDepth;
    const depth = typeof depthRaw === 'number' ? depthRaw : 0;
    if (depth >= MAX_HANDOFF_DEPTH) {
      return null;
    }

    const metadataTarget = typeof request.metadata?.subagentId === 'string' ? request.metadata.subagentId : undefined;
    let target = metadataTarget;

    if (!target) {
      const plainText = normalizedMessage
        .filter((part): part is Extract<MessagePart, { type: 'plain' }> => part.type === 'plain')
        .map((part) => part.text)
        .join('\n')
        .toLowerCase();

      const mention = config.agents.find((agent) => plainText.includes(`@${agent.subagentId.toLowerCase()}`));
      target = mention?.subagentId;
    }

    if (!target) {
      return null;
    }

    const agent = config.agents.find((item) => item.subagentId === target && item.enabled);
    if (!agent) {
      return null;
    }

    const reason = typeof request.metadata?.handoffReason === 'string' ? request.metadata.handoffReason : `handoff_to_${agent.subagentId}`;

    return {
      from: 'main',
      to: agent.subagentId,
      reason
    };
  }

  applyHandoffContext(request: RuntimeChatRequestInput, handoff: { to: string }): void {
    const metadata = request.metadata ?? {};
    const runtimeVariablesRaw = metadata.runtimeVariables;
    const runtimeVariables =
      typeof runtimeVariablesRaw === 'object' && runtimeVariablesRaw !== null && !Array.isArray(runtimeVariablesRaw)
        ? (runtimeVariablesRaw as Record<string, unknown>)
        : {};

    const nextDepth = typeof metadata.handoffDepth === 'number' ? metadata.handoffDepth + 1 : 1;
    request.metadata = {
      ...metadata,
      subagentId: handoff.to,
      handoffDepth: nextDepth,
      runtimeVariables: {
        ...runtimeVariables,
        subagent_id: handoff.to
      }
    };
  }

  private async syncFromConfig(config: SubagentConfig): Promise<void> {
    const existing = await this.repository.list();
    const incomingMap = new Map(config.agents.map((agent) => [agent.subagentId, agent]));

    await Promise.all(
      config.agents.map((agent) =>
        this.repository.upsert({
          subagentId: agent.subagentId,
          name: agent.name,
          enabled: agent.enabled,
          ...(agent.systemPrompt ? { systemPrompt: agent.systemPrompt } : {}),
          tools: agent.tools
        })
      )
    );

    await Promise.all(existing.filter((item) => !incomingMap.has(item.subagentId)).map((item) => this.repository.delete(item.subagentId)));
  }

  private async reregisterHandoffTools(): Promise<void> {
    for (const toolName of this.registeredHandoffTools) {
      await this.toolRegistry.remove(toolName).catch(() => undefined);
    }
    this.registeredHandoffTools.clear();

    const config = await this.getConfig();
    for (const agent of config.agents) {
      if (!agent.enabled) {
        continue;
      }

      const toolName = normalizeSubagentToolName(agent.subagentId);
      await this.toolRegistry.register({
        meta: {
          toolName,
          description: `Handoff execution to subagent ${agent.subagentId}`,
          enabled: true,
          source: 'builtin',
          schema: {
            reason: { type: 'string', required: false }
          }
        },
        handler: (args) => ({
          from: 'main',
          to: agent.subagentId,
          reason: typeof args.reason === 'string' ? args.reason : `tool_handoff_${agent.subagentId}`
        })
      });
      this.registeredHandoffTools.add(toolName);
    }
  }
}
