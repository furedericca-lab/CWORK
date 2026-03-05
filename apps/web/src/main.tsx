import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CapabilityStatusResponse, DifyConfig, ProactiveJobCreateRequest, RuntimeSseEventPayloadMap, SubagentConfig } from '@cwork/shared';
import { ApiError, createApiClient, type RequestTraceEntry, type RuntimeSseEventEnvelope } from './api/client';
import './styles.css';

const queryClient = new QueryClient();
const API_TOKEN_KEY = 'cwork.web.apiToken';

type PageKey = 'overview' | 'runtime' | 'dify' | 'plugins' | 'skills-tools' | 'mcp' | 'subagents' | 'proactive';

const pageItems: Array<{ key: PageKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'runtime', label: '运行控制台' },
  { key: 'dify', label: 'Dify 设置' },
  { key: 'plugins', label: '插件' },
  { key: 'skills-tools', label: '技能 / 工具 / 知识库' },
  { key: 'mcp', label: 'MCP' },
  { key: 'subagents', label: '子代理' },
  { key: 'proactive', label: '主动任务' }
];

const formatError = (error: unknown): string => {
  if (error instanceof ApiError) {
    return `[${error.statusCode}] ${error.message} (requestId: ${error.requestId})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const stringifyJson = (value: unknown): string => JSON.stringify(value, null, 2);

const getStoredApiToken = (): string => {
  if (typeof localStorage === 'undefined') {
    return import.meta.env.DEV ? 'dev-token' : '';
  }
  return localStorage.getItem(API_TOKEN_KEY) ?? (import.meta.env.DEV ? 'dev-token' : '');
};

const StatusChip = ({ ok, text }: { ok: boolean; text: string }) => {
  return <span className={`status-chip ${ok ? 'status-chip-ok' : 'status-chip-error'}`}>{text}</span>;
};

const isMetaEvent = (event: RuntimeSseEventEnvelope): event is RuntimeSseEventEnvelope<'meta'> => event.event === 'meta';
const getStreamStatusLabel = (status: 'idle' | 'running' | 'failed' | 'done'): string => {
  switch (status) {
    case 'idle':
      return '空闲';
    case 'running':
      return '进行中';
    case 'failed':
      return '失败';
    case 'done':
      return '完成';
    default:
      return status;
  }
};

interface PanelProps {
  title: string;
  children: React.ReactNode;
  subtitle?: string | undefined;
}

const Panel = ({ title, subtitle, children }: PanelProps) => {
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
};

interface AppContext {
  api: ReturnType<typeof createApiClient>;
}

const OverviewPage = ({ api }: AppContext) => {
  const healthQuery = useQuery({
    queryKey: ['healthz'],
    queryFn: () => api.getHealthz(),
    refetchInterval: 15_000
  });

  const readyQuery = useQuery({
    queryKey: ['readyz'],
    queryFn: () => api.getReadyz(),
    refetchInterval: 15_000
  });

  const capabilitiesQuery = useQuery({
    queryKey: ['capabilities-status'],
    queryFn: () => api.getCapabilityStatus(),
    refetchInterval: 15_000
  });

  const capabilityEntries: Array<[keyof CapabilityStatusResponse, CapabilityStatusResponse[keyof CapabilityStatusResponse]]> =
    capabilitiesQuery.data
      ? (Object.entries(capabilitiesQuery.data) as Array<
          [keyof CapabilityStatusResponse, CapabilityStatusResponse[keyof CapabilityStatusResponse]]
        >)
      : [];

  return (
    <div className="page-grid">
      <Panel title="服务健康" subtitle="存活、就绪与能力心跳">
        <div className="kv-list">
          <div>
            <span>存活</span>
            <StatusChip ok={healthQuery.data?.ok === true} text={healthQuery.data?.ok ? '健康' : '未知'} />
          </div>
          <div>
            <span>就绪</span>
            <StatusChip ok={readyQuery.data?.ok === true} text={readyQuery.data?.ok ? '就绪' : '未就绪'} />
          </div>
          <div>
            <span>提供方</span>
            <strong>{readyQuery.data?.provider ?? '无'}</strong>
          </div>
        </div>
      </Panel>

      <Panel title="能力状态" subtitle="后端上报的运行能力状态">
        {capabilitiesQuery.isLoading ? <p>正在加载能力状态...</p> : null}
        {capabilitiesQuery.isError ? <p className="error-text">{formatError(capabilitiesQuery.error)}</p> : null}
        <div className="capability-grid">
          {capabilityEntries.map(([name, state]) => (
            <article className="capability-card" key={name}>
              <h3>{name}</h3>
              <p>
                已启用: <strong>{String(state.enabled)}</strong>
              </p>
              <p>
                健康: <strong>{String(state.healthy)}</strong>
              </p>
              <p>上次检查: {state.lastCheckAt ?? '无'}</p>
              <p>最近错误: {state.lastError ?? '无'}</p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
};

const RuntimeConsolePage = ({ api }: AppContext) => {
  const sessionsQuery = useQuery({
    queryKey: ['runtime-sessions'],
    queryFn: () => api.getRuntimeSessions(1, 50)
  });
  const queryClientInternal = useQueryClient();
  const [sessionId, setSessionId] = useState('');
  const [message, setMessage] = useState('来自 CWORK WebUI 的问候');
  const [events, setEvents] = useState<RuntimeSseEventEnvelope[]>([]);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'running' | 'failed' | 'done'>('idle');
  const [streamError, setStreamError] = useState<string | null>(null);

  const runChat = async () => {
    setEvents([]);
    setStreamStatus('running');
    setStreamError(null);

    try {
      await api.streamRuntimeChat(
        {
          ...(sessionId ? { sessionId } : {}),
          message,
          enableStreaming: true
        },
        {
          onEvent: (event) => {
            setEvents((prev) => [...prev, event]);
            if (isMetaEvent(event) && event.data.sessionId) {
              setSessionId(event.data.sessionId);
            }
          }
        }
      );
      setStreamStatus('done');
      await queryClientInternal.invalidateQueries({ queryKey: ['runtime-sessions'] });
    } catch (error) {
      setStreamStatus('failed');
      setStreamError(formatError(error));
    }
  };

  const finalResultEvent = events.find((event): event is RuntimeSseEventEnvelope<'final_result'> => event.event === 'final_result');
  const finalText = finalResultEvent?.data.messageChain
    .filter((part): part is Extract<RuntimeSseEventPayloadMap['final_result']['messageChain'][number], { type: 'plain' }> => {
      return part.type === 'plain';
    })
    .map((part) => part.text)
    .join('\n');

  return (
    <div className="page-grid">
      <Panel title="运行控制台" subtitle="SSE 流、事件时间线与最终消息链">
        <div className="form-grid">
          <label>
            会话 ID（可选）
            <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="sess_001" />
          </label>
          <label className="full-span">
            消息
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
          </label>
        </div>
        <div className="row">
          <button type="button" onClick={() => void runChat()} disabled={streamStatus === 'running' || message.trim().length === 0}>
            {streamStatus === 'running' ? '流式处理中...' : '发送对话'}
          </button>
          <StatusChip ok={streamStatus !== 'failed'} text={getStreamStatusLabel(streamStatus)} />
        </div>
        {streamError ? <p className="error-text">{streamError}</p> : null}
        {finalText ? (
          <div className="output-box">
            <h3>最终输出</h3>
            <pre>{finalText}</pre>
          </div>
        ) : null}
        <div className="event-list">
          {events.map((event, index) => (
            <article key={`${event.event}_${index}`} className="event-item">
              <header>
                <strong>{event.event}</strong>
              </header>
              <pre>{stringifyJson(event.data)}</pre>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="会话选择" subtitle="来自运行时存储的近期会话">
        {sessionsQuery.isLoading ? <p>正在加载会话...</p> : null}
        {sessionsQuery.isError ? <p className="error-text">{formatError(sessionsQuery.error)}</p> : null}
        <ul className="simple-list">
          {(sessionsQuery.data?.items ?? []).map((session) => (
            <li key={session.sessionId}>
              <button type="button" onClick={() => setSessionId(session.sessionId)}>
                {session.displayName} ({session.sessionId})
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};

const DifySettingsPage = ({ api }: AppContext) => {
  const queryClientInternal = useQueryClient();
  const difyQuery = useQuery({
    queryKey: ['dify-config'],
    queryFn: () => api.getDifyConfig()
  });

  const [form, setForm] = useState<DifyConfig>({
    providerId: 'dify_app_default',
    difyApiKey: '${DIFY_API_KEY}',
    difyApiBase: 'https://api.dify.ai/v1',
    difyApiType: 'chat',
    difyWorkflowOutputKey: 'astrbot_wf_output',
    difyQueryInputKey: 'astrbot_text_query',
    timeoutSec: 30,
    variables: {}
  });
  const [variablesRaw, setVariablesRaw] = useState('{}');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!difyQuery.data) {
      return;
    }
    setForm({
      providerId: difyQuery.data.providerId,
      difyApiKey: '${DIFY_API_KEY}',
      difyApiBase: difyQuery.data.difyApiBase,
      difyApiType: difyQuery.data.difyApiType,
      difyWorkflowOutputKey: difyQuery.data.difyWorkflowOutputKey,
      difyQueryInputKey: difyQuery.data.difyQueryInputKey,
      timeoutSec: difyQuery.data.timeoutSec,
      variables: difyQuery.data.variables ?? {}
    });
    setVariablesRaw(stringifyJson(difyQuery.data.variables ?? {}));
  }, [difyQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsedVariables: Record<string, unknown> = {};
      try {
        parsedVariables = JSON.parse(variablesRaw) as Record<string, unknown>;
      } catch (error) {
        throw new Error(`变量 JSON 格式错误：${error instanceof Error ? error.message : String(error)}`);
      }

      const payload: DifyConfig = {
        ...form,
        variables: parsedVariables
      };
      return api.updateDifyConfig(payload);
    },
    onSuccess: async () => {
      setFeedback('Dify 配置已更新。');
      setErrorText(null);
      await queryClientInternal.invalidateQueries({ queryKey: ['dify-config'] });
    },
    onError: (error) => {
      setFeedback(null);
      setErrorText(formatError(error));
    }
  });

  return (
    <Panel title="Dify 设置" subtitle="仅 Dify 提供方配置">
      <div className="form-grid">
        <label>
          提供方 ID
          <input value={form.providerId} onChange={(event) => setForm((prev) => ({ ...prev, providerId: event.target.value }))} />
        </label>
        <label>
          API 密钥
          <input value={form.difyApiKey ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, difyApiKey: event.target.value }))} />
        </label>
        <label>
          API 地址
          <input value={form.difyApiBase} onChange={(event) => setForm((prev) => ({ ...prev, difyApiBase: event.target.value }))} />
        </label>
        <label>
          API 类型
          <select
            value={form.difyApiType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, difyApiType: event.target.value as DifyConfig['difyApiType'] }))
            }
          >
            <option value="chat">chat</option>
            <option value="agent">agent</option>
            <option value="chatflow">chatflow</option>
            <option value="workflow">workflow</option>
          </select>
        </label>
        <label>
          Workflow 输出键
          <input
            value={form.difyWorkflowOutputKey}
            onChange={(event) => setForm((prev) => ({ ...prev, difyWorkflowOutputKey: event.target.value }))}
          />
        </label>
        <label>
          Query 输入键
          <input
            value={form.difyQueryInputKey}
            onChange={(event) => setForm((prev) => ({ ...prev, difyQueryInputKey: event.target.value }))}
          />
        </label>
        <label>
          超时秒数
          <input
            type="number"
            min={1}
            value={form.timeoutSec}
            onChange={(event) => setForm((prev) => ({ ...prev, timeoutSec: Number(event.target.value) }))}
          />
        </label>
        <label className="full-span">
          变量 JSON
          <textarea value={variablesRaw} onChange={(event) => setVariablesRaw(event.target.value)} rows={6} />
        </label>
      </div>
      <div className="row">
        <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? '保存中...' : '保存 Dify 配置'}
        </button>
      </div>
      {feedback ? <p className="success-text">{feedback}</p> : null}
      {errorText ? <p className="error-text">{errorText}</p> : null}
      {difyQuery.data ? <p className="muted-text">脱敏密钥：{difyQuery.data.masked.difyApiKey}</p> : null}
    </Panel>
  );
};

const PluginsPage = ({ api }: AppContext) => {
  const queryClientInternal = useQueryClient();
  const pluginsQuery = useQuery({
    queryKey: ['plugins'],
    queryFn: () => api.listPlugins()
  });

  const [localPath, setLocalPath] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoRef, setRepoRef] = useState('main');
  const [statusText, setStatusText] = useState<string | null>(null);

  const refresh = async () => queryClientInternal.invalidateQueries({ queryKey: ['plugins'] });

  const runPluginAction = async (task: () => Promise<unknown>, okText: string) => {
    try {
      await task();
      setStatusText(okText);
      await refresh();
    } catch (error) {
      setStatusText(formatError(error));
    }
  };

  return (
    <Panel title="插件管理" subtitle="本地与 Git 插件生命周期操作">
      <div className="form-grid">
        <label>
          本地导入路径
          <input value={localPath} onChange={(event) => setLocalPath(event.target.value)} placeholder="/path/to/plugin" />
        </label>
        <div className="row align-end">
          <button
            type="button"
            onClick={() =>
              void runPluginAction(
                () => api.importPluginLocal({ path: localPath }),
                `已从本地路径导入插件：${localPath}`
              )
            }
            disabled={localPath.trim().length === 0}
          >
            本地导入
          </button>
        </div>
        <label>
          Git 仓库地址
          <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/org/repo" />
        </label>
        <label>
          分支/标签
          <input value={repoRef} onChange={(event) => setRepoRef(event.target.value)} placeholder="main" />
        </label>
        <div className="row align-end">
          <button
            type="button"
            onClick={() =>
              void runPluginAction(
                () => api.importPluginGit({ repoUrl, ...(repoRef ? { ref: repoRef } : {}) }),
                `已从仓库导入插件：${repoUrl}`
              )
            }
            disabled={repoUrl.trim().length === 0}
          >
            Git 导入
          </button>
        </div>
      </div>

      {statusText ? <p className="muted-text">{statusText}</p> : null}
      {pluginsQuery.isError ? <p className="error-text">{formatError(pluginsQuery.error)}</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>插件</th>
            <th>状态</th>
            <th>来源</th>
            <th>错误</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {(pluginsQuery.data?.items ?? []).map((plugin) => (
            <tr key={plugin.pluginId}>
              <td>{plugin.pluginId}</td>
              <td>{plugin.status}</td>
              <td>{plugin.source}</td>
              <td>{plugin.error ?? '无'}</td>
              <td>
                <div className="inline-actions">
                  <button type="button" onClick={() => void runPluginAction(() => api.enablePlugin(plugin.pluginId), `已启用 ${plugin.pluginId}`)}>
                    启用
                  </button>
                  <button
                    type="button"
                    onClick={() => void runPluginAction(() => api.disablePlugin(plugin.pluginId), `已停用 ${plugin.pluginId}`)}
                  >
                    停用
                  </button>
                  <button type="button" onClick={() => void runPluginAction(() => api.reloadPlugin(plugin.pluginId), `已重载 ${plugin.pluginId}`)}>
                    重载
                  </button>
                  <button
                    type="button"
                    onClick={() => void runPluginAction(() => api.uninstallPlugin(plugin.pluginId), `已卸载 ${plugin.pluginId}`)}
                  >
                    卸载
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
};

const SkillsToolsPage = ({ api }: AppContext) => {
  const queryClientInternal = useQueryClient();
  const skillsQuery = useQuery({ queryKey: ['skills'], queryFn: () => api.listSkills() });
  const toolsQuery = useQuery({ queryKey: ['tools'], queryFn: () => api.listTools() });
  const docsQuery = useQuery({ queryKey: ['kb-docs'], queryFn: () => api.listKnowledgeDocuments() });

  const [skillZipPath, setSkillZipPath] = useState('');
  const [toolName, setToolName] = useState('tool.echo');
  const [toolArgs, setToolArgs] = useState('{"text":"hello from web"}');
  const [toolSessionId, setToolSessionId] = useState('');
  const [toolOutput, setToolOutput] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('');
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docSource, setDocSource] = useState('');
  const [retrieveQuery, setRetrieveQuery] = useState('Dify');
  const [retrieveTopK, setRetrieveTopK] = useState(3);
  const [retrieveResult, setRetrieveResult] = useState('');

  const refreshSkills = async () => queryClientInternal.invalidateQueries({ queryKey: ['skills'] });
  const refreshTools = async () => queryClientInternal.invalidateQueries({ queryKey: ['tools'] });
  const refreshDocs = async () => queryClientInternal.invalidateQueries({ queryKey: ['kb-docs'] });

  const runAction = async (task: () => Promise<unknown>, successMessage: string, onAfter?: () => Promise<void>) => {
    try {
      await task();
      if (onAfter) {
        await onAfter();
      }
      setStatusText(successMessage);
    } catch (error) {
      setStatusText(formatError(error));
    }
  };

  const executeTool = async () => {
    try {
      const parsedArgs = JSON.parse(toolArgs) as Record<string, unknown>;
      const result = await api.executeTool({
        toolName,
        arguments: parsedArgs,
        ...(toolSessionId ? { sessionId: toolSessionId } : {})
      });
      setToolOutput(stringifyJson(result));
    } catch (error) {
      setToolOutput(formatError(error));
    }
  };

  return (
    <div className="page-grid">
      <Panel title="技能" subtitle="重载、导入、开关与删除本地技能">
        <div className="row">
          <button type="button" onClick={() => void runAction(() => api.reloadSkills(), '技能已重载', refreshSkills)}>
            重载技能
          </button>
        </div>
        <div className="form-grid">
          <label>
            技能 ZIP 路径
            <input value={skillZipPath} onChange={(event) => setSkillZipPath(event.target.value)} placeholder="/tmp/my-skill.zip" />
          </label>
          <div className="row align-end">
            <button
              type="button"
              onClick={() => void runAction(() => api.importSkill(skillZipPath), `已导入技能：${skillZipPath}`, refreshSkills)}
              disabled={skillZipPath.trim().length === 0}
            >
              导入技能
            </button>
          </div>
        </div>
        <p className="muted-text">提示词块：</p>
        <pre className="compact-pre">{skillsQuery.data?.promptBlock ?? ''}</pre>
        <ul className="simple-list">
          {(skillsQuery.data?.items ?? []).map((skill) => (
            <li key={skill.skillId}>
              <strong>{skill.skillId}</strong> ({skill.scope ?? 'both'}) - 已启用：{String(skill.enabled)}
              <div className="inline-actions">
                <button type="button" onClick={() => void runAction(() => api.enableSkill(skill.skillId), `已启用 ${skill.skillId}`, refreshSkills)}>
                  启用
                </button>
                <button type="button" onClick={() => void runAction(() => api.disableSkill(skill.skillId), `已停用 ${skill.skillId}`, refreshSkills)}>
                  停用
                </button>
                <button type="button" onClick={() => void runAction(() => api.deleteSkill(skill.skillId), `已删除 ${skill.skillId}`, refreshSkills)}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="工具" subtitle="工具清单与调试执行">
        <div className="row">
          <button type="button" onClick={() => void runAction(() => api.reloadTools(), '工具已重载', refreshTools)}>
            重载工具
          </button>
        </div>
        <div className="form-grid">
          <label>
            工具名
            <input value={toolName} onChange={(event) => setToolName(event.target.value)} />
          </label>
          <label>
            会话 ID（可选）
            <input value={toolSessionId} onChange={(event) => setToolSessionId(event.target.value)} />
          </label>
          <label className="full-span">
            参数 JSON
            <textarea value={toolArgs} onChange={(event) => setToolArgs(event.target.value)} rows={4} />
          </label>
        </div>
        <div className="row">
          <button type="button" onClick={() => void executeTool()}>
            执行工具
          </button>
        </div>
        <pre className="compact-pre">{toolOutput}</pre>
        <table className="table">
          <thead>
            <tr>
              <th>工具</th>
              <th>来源</th>
              <th>已启用</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {(toolsQuery.data?.items ?? []).map((tool) => (
              <tr key={tool.toolName}>
                <td>{tool.toolName}</td>
                <td>{tool.source}</td>
                <td>{String(tool.enabled)}</td>
                <td>
                  <div className="inline-actions">
                    <button type="button" onClick={() => void runAction(() => api.enableTool(tool.toolName), `已启用 ${tool.toolName}`, refreshTools)}>
                      启用
                    </button>
                    <button type="button" onClick={() => void runAction(() => api.disableTool(tool.toolName), `已停用 ${tool.toolName}`, refreshTools)}>
                      停用
                    </button>
                    <button type="button" onClick={() => void runAction(() => api.deleteTool(tool.toolName), `已删除 ${tool.toolName}`, refreshTools)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="知识库" subtitle="文档增删改查与检索">
        <div className="form-grid">
          <label>
            标题
            <input value={docTitle} onChange={(event) => setDocTitle(event.target.value)} />
          </label>
          <label>
            来源（可选）
            <input value={docSource} onChange={(event) => setDocSource(event.target.value)} />
          </label>
          <label className="full-span">
            内容
            <textarea value={docContent} onChange={(event) => setDocContent(event.target.value)} rows={4} />
          </label>
        </div>
        <div className="row">
          <button
            type="button"
            onClick={() =>
              void runAction(
                () => api.createKnowledgeDocument({ title: docTitle, content: docContent, ...(docSource ? { source: docSource } : {}) }),
                `已创建文档：${docTitle}`,
                refreshDocs
              )
            }
            disabled={docTitle.trim().length === 0 || docContent.trim().length === 0}
          >
            创建文档
          </button>
        </div>
        <div className="form-grid">
          <label>
            检索问题
            <input value={retrieveQuery} onChange={(event) => setRetrieveQuery(event.target.value)} />
          </label>
          <label>
            Top K
            <input type="number" min={1} value={retrieveTopK} onChange={(event) => setRetrieveTopK(Number(event.target.value))} />
          </label>
          <div className="row align-end">
            <button
              type="button"
              onClick={() =>
                void runAction(
                  async () => {
                    const result = await api.retrieveKnowledge({ query: retrieveQuery, topK: retrieveTopK });
                    setRetrieveResult(stringifyJson(result));
                  },
                  '知识检索完成'
                )
              }
            >
              检索
            </button>
          </div>
        </div>
        <pre className="compact-pre">{retrieveResult}</pre>
        <ul className="simple-list">
          {(docsQuery.data?.items ?? []).map((doc) => (
            <li key={doc.docId}>
              <strong>{doc.title}</strong> ({doc.docId})
              <div className="inline-actions">
                <button type="button" onClick={() => void runAction(() => api.deleteKnowledgeDocument(doc.docId), `已删除 ${doc.docId}`, refreshDocs)}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
      {statusText ? <p className="muted-text">{statusText}</p> : null}
    </div>
  );
};

const McpPage = ({ api }: AppContext) => {
  const queryClientInternal = useQueryClient();
  const mcpQuery = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: () => api.listMcpServers()
  });
  const [name, setName] = useState('demo_mcp');
  const [enabled, setEnabled] = useState(true);
  const [transport, setTransport] = useState<'stdio' | 'http' | 'sse'>('stdio');
  const [command, setCommand] = useState('node');
  const [argsRaw, setArgsRaw] = useState('["-v"]');
  const [url, setUrl] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(10);
  const [statusText, setStatusText] = useState('');

  const refresh = async () => queryClientInternal.invalidateQueries({ queryKey: ['mcp-servers'] });

  const makePayload = () => {
    const args = JSON.parse(argsRaw) as string[];
    return {
      name,
      enabled,
      transport,
      ...(transport === 'stdio' ? { command, args } : {}),
      ...(transport === 'http' || transport === 'sse' ? { url } : {}),
      timeoutSec
    };
  };

  const runAction = async (task: () => Promise<unknown>, message: string) => {
    try {
      await task();
      setStatusText(message);
      await refresh();
    } catch (error) {
      setStatusText(formatError(error));
    }
  };

  return (
    <Panel title="MCP 管理" subtitle="新增 / 更新 / 测试 / 开关 / 删除 MCP 服务">
      <div className="form-grid">
        <label>
          名称
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          传输方式
          <select value={transport} onChange={(event) => setTransport(event.target.value as 'stdio' | 'http' | 'sse')}>
            <option value="stdio">stdio</option>
            <option value="http">http</option>
            <option value="sse">sse</option>
          </select>
        </label>
        <label>
          已启用
          <select value={String(enabled)} onChange={(event) => setEnabled(event.target.value === 'true')}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
        <label>
          命令
          <input value={command} onChange={(event) => setCommand(event.target.value)} />
        </label>
        <label className="full-span">
          参数 JSON
          <input value={argsRaw} onChange={(event) => setArgsRaw(event.target.value)} />
        </label>
        <label>
          URL
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/mcp" />
        </label>
        <label>
          超时秒数
          <input type="number" value={timeoutSec} min={1} onChange={(event) => setTimeoutSec(Number(event.target.value))} />
        </label>
      </div>
      <div className="row">
        <button type="button" onClick={() => void runAction(() => api.addMcpServer(makePayload()), `已新增 ${name}`)}>
          新增
        </button>
        <button type="button" onClick={() => void runAction(() => api.updateMcpServer(makePayload()), `已更新 ${name}`)}>
          更新
        </button>
        <button type="button" onClick={() => void runAction(() => api.testMcpServer(name), `已测试 ${name}`)}>
          测试
        </button>
      </div>
      <p className="muted-text">{statusText}</p>
      <table className="table">
        <thead>
          <tr>
            <th>名称</th>
            <th>传输方式</th>
            <th>已启用</th>
            <th>健康</th>
            <th>错误</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {(mcpQuery.data?.items ?? []).map((server) => (
            <tr key={server.name}>
              <td>{server.name}</td>
              <td>{server.transport}</td>
              <td>{String(server.enabled)}</td>
              <td>{String(server.runtime.healthy)}</td>
              <td>{server.runtime.lastError ?? '无'}</td>
              <td>
                <div className="inline-actions">
                  <button type="button" onClick={() => void runAction(() => api.enableMcpServer(server.name), `已启用 ${server.name}`)}>
                    启用
                  </button>
                  <button type="button" onClick={() => void runAction(() => api.disableMcpServer(server.name), `已停用 ${server.name}`)}>
                    停用
                  </button>
                  <button type="button" onClick={() => void runAction(() => api.deleteMcpServer(server.name), `已删除 ${server.name}`)}>
                    删除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
};

const SubagentsPage = ({ api }: AppContext) => {
  const queryClientInternal = useQueryClient();
  const configQuery = useQuery({ queryKey: ['subagents-config'], queryFn: () => api.getSubagents() });
  const toolsQuery = useQuery({ queryKey: ['subagents-tools'], queryFn: () => api.getSubagentAvailableTools() });
  const [configRaw, setConfigRaw] = useState('');
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (configQuery.data) {
      setConfigRaw(stringifyJson(configQuery.data));
    }
  }, [configQuery.data]);

  const saveConfig = async () => {
    try {
      const parsed = JSON.parse(configRaw) as SubagentConfig;
      await api.updateSubagents(parsed);
      setStatusText('子代理配置已更新。');
      await Promise.all([
        queryClientInternal.invalidateQueries({ queryKey: ['subagents-config'] }),
        queryClientInternal.invalidateQueries({ queryKey: ['subagents-tools'] }),
        queryClientInternal.invalidateQueries({ queryKey: ['tools'] })
      ]);
    } catch (error) {
      setStatusText(formatError(error));
    }
  };

  return (
    <div className="page-grid">
      <Panel title="子代理配置" subtitle="带服务端 Schema 校验的 JSON 编辑器">
        <textarea value={configRaw} onChange={(event) => setConfigRaw(event.target.value)} rows={18} className="json-editor" />
        <div className="row">
          <button type="button" onClick={() => void saveConfig()}>
            保存配置
          </button>
        </div>
        <p className="muted-text">{statusText}</p>
      </Panel>

      <Panel title="可用工具" subtitle="子代理工具分配来源">
        <ul className="simple-list">
          {(toolsQuery.data?.items ?? []).map((tool) => (
            <li key={tool.toolName}>
              {tool.toolName} <span className="muted-text">({tool.source})</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};

const ProactivePage = ({ api }: AppContext) => {
  const queryClientInternal = useQueryClient();
  const proactiveQuery = useQuery({ queryKey: ['proactive-jobs'], queryFn: () => api.listProactiveJobs() });
  const [form, setForm] = useState<ProactiveJobCreateRequest>({
    name: 'daily-briefing',
    sessionId: 'sess_001',
    prompt: '发送今日摘要',
    cronExpression: '0 9 * * *',
    timezone: 'UTC',
    runOnce: false,
    enabled: true
  });
  const [statusText, setStatusText] = useState('');

  const refresh = async () => queryClientInternal.invalidateQueries({ queryKey: ['proactive-jobs'] });

  const createJob = async () => {
    try {
      await api.createProactiveJob(form);
      setStatusText(`已创建主动任务：${form.name}`);
      await refresh();
    } catch (error) {
      setStatusText(formatError(error));
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      await api.deleteProactiveJob(jobId);
      setStatusText(`已删除主动任务：${jobId}`);
      await refresh();
    } catch (error) {
      setStatusText(formatError(error));
    }
  };

  return (
    <Panel title="主动任务" subtitle="创建和删除计划任务">
      <div className="form-grid">
        <label>
          名称
          <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        </label>
        <label>
          会话 ID
          <input value={form.sessionId} onChange={(event) => setForm((prev) => ({ ...prev, sessionId: event.target.value }))} />
        </label>
        <label className="full-span">
          提示词
          <textarea value={form.prompt} onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))} rows={3} />
        </label>
        <label>
          Cron 表达式
          <input
            value={form.cronExpression ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, cronExpression: event.target.value || undefined }))}
          />
        </label>
        <label>
          执行时间（ISO）
          <input value={form.runAt ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, runAt: event.target.value || undefined }))} />
        </label>
        <label>
          时区
          <input
            value={form.timezone ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value || undefined }))}
            placeholder="UTC"
          />
        </label>
        <label>
          仅运行一次
          <select value={String(form.runOnce ?? false)} onChange={(event) => setForm((prev) => ({ ...prev, runOnce: event.target.value === 'true' }))}>
            <option value="false">否</option>
            <option value="true">是</option>
          </select>
        </label>
        <label>
          已启用
          <select value={String(form.enabled ?? true)} onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.value === 'true' }))}>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </label>
      </div>

      <div className="row">
        <button type="button" onClick={() => void createJob()}>
          创建任务
        </button>
      </div>
      <p className="muted-text">{statusText}</p>
      <table className="table">
        <thead>
          <tr>
            <th>任务 ID</th>
            <th>名称</th>
            <th>状态</th>
            <th>已启用</th>
            <th>调度</th>
            <th>时区</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {(proactiveQuery.data?.items ?? []).map((job) => (
            <tr key={job.jobId}>
              <td>{job.jobId}</td>
              <td>{job.name}</td>
              <td>{job.status}</td>
              <td>{String(job.enabled)}</td>
              <td>{job.runOnce ? job.runAt ?? '仅一次' : job.cronExpression ?? '无'}</td>
              <td>{job.timezone ?? 'UTC'}</td>
              <td>
                <button type="button" onClick={() => void deleteJob(job.jobId)}>
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
};

const DiagnosticsPanel = ({
  traces,
  onClear
}: {
  traces: RequestTraceEntry[];
  onClear: () => void;
}) => {
  return (
    <aside className="diagnostics">
      <header>
        <h2>诊断</h2>
        <button type="button" onClick={onClear}>
          清空
        </button>
      </header>
      <p className="muted-text">请求关联时间线（x-request-id）</p>
      <ul>
        {traces.map((entry) => (
          <li key={`${entry.requestId}_${entry.endedAt}`}>
            <div>
              <strong>{entry.requestId}</strong>
            </div>
            <div>
              {entry.method} {entry.path}
            </div>
            <div>
              状态={entry.statusCode} 耗时={entry.durationMs}ms
            </div>
            {entry.errorMessage ? <div className="error-text">{entry.errorMessage}</div> : null}
          </li>
        ))}
      </ul>
    </aside>
  );
};

function App() {
  const [page, setPage] = useState<PageKey>('overview');
  const [apiToken, setApiToken] = useState(getStoredApiToken);
  const [traces, setTraces] = useState<RequestTraceEntry[]>([]);

  useEffect(() => {
    localStorage.setItem(API_TOKEN_KEY, apiToken);
  }, [apiToken]);

  const api = useMemo(
    () =>
      createApiClient({
        getAuthToken: () => apiToken,
        onTrace: (entry) => {
          setTraces((prev) => [entry, ...prev].slice(0, 80));
        }
      }),
    [apiToken]
  );

  const pageContent = (() => {
    switch (page) {
      case 'overview':
        return <OverviewPage api={api} />;
      case 'runtime':
        return <RuntimeConsolePage api={api} />;
      case 'dify':
        return <DifySettingsPage api={api} />;
      case 'plugins':
        return <PluginsPage api={api} />;
      case 'skills-tools':
        return <SkillsToolsPage api={api} />;
      case 'mcp':
        return <McpPage api={api} />;
      case 'subagents':
        return <SubagentsPage api={api} />;
      case 'proactive':
        return <ProactivePage api={api} />;
      default:
        return null;
    }
  })();

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>CWORK 运维控制台</h1>
          <p>第 5 阶段 WebUI 基础：覆盖运行时、工具、技能、插件、MCP、子代理、主动任务与诊断。</p>
        </div>
        <label className="token-input">
          API 令牌
          <input value={apiToken} onChange={(event) => setApiToken(event.target.value)} />
        </label>
      </header>

      <div className="layout">
        <nav className="sidebar">
          {pageItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === page ? 'active' : ''}
              onClick={() => {
                setPage(item.key);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section className="content">{pageContent}</section>

        <DiagnosticsPanel traces={traces} onClear={() => setTraces([])} />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
