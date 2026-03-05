import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CapabilityStatusResponse, DifyConfig, ProactiveJobCreateRequest, RuntimeSseEventPayloadMap, SubagentConfig } from '@cwork/shared';
import { ApiError, createApiClient, type RequestTraceEntry, type RuntimeSseEventEnvelope } from './api/client';
import './i18n';
import './styles.css';

const queryClient = new QueryClient();
const API_TOKEN_KEY = 'cwork.web.apiToken';

type PageKey = 'overview' | 'runtime' | 'dify' | 'plugins' | 'skills-tools' | 'mcp' | 'subagents' | 'proactive';

const pageItems: Array<{ key: PageKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'runtime', label: 'Runtime Console' },
  { key: 'dify', label: 'Dify Settings' },
  { key: 'plugins', label: 'Plugins' },
  { key: 'skills-tools', label: 'Skills / Tools / Knowledge' },
  { key: 'mcp', label: 'MCP' },
  { key: 'subagents', label: 'SubAgents' },
  { key: 'proactive', label: 'Proactive Jobs' }
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
    return 'dev-token';
  }
  return localStorage.getItem(API_TOKEN_KEY) ?? 'dev-token';
};

const StatusChip = ({ ok, text }: { ok: boolean; text: string }) => {
  return <span className={`status-chip ${ok ? 'status-chip-ok' : 'status-chip-error'}`}>{text}</span>;
};

const isMetaEvent = (event: RuntimeSseEventEnvelope): event is RuntimeSseEventEnvelope<'meta'> => event.event === 'meta';

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
      <Panel title="Service Health" subtitle="Liveness, readiness, and capability heartbeat">
        <div className="kv-list">
          <div>
            <span>Health</span>
            <StatusChip ok={healthQuery.data?.ok === true} text={healthQuery.data?.ok ? 'Healthy' : 'Unknown'} />
          </div>
          <div>
            <span>Readiness</span>
            <StatusChip ok={readyQuery.data?.ok === true} text={readyQuery.data?.ok ? 'Ready' : 'Not Ready'} />
          </div>
          <div>
            <span>Provider</span>
            <strong>{readyQuery.data?.provider ?? 'n/a'}</strong>
          </div>
        </div>
      </Panel>

      <Panel title="Capability Status" subtitle="Backend-reported runtime capability states">
        {capabilitiesQuery.isLoading ? <p>Loading capability status...</p> : null}
        {capabilitiesQuery.isError ? <p className="error-text">{formatError(capabilitiesQuery.error)}</p> : null}
        <div className="capability-grid">
          {capabilityEntries.map(([name, state]) => (
            <article className="capability-card" key={name}>
              <h3>{name}</h3>
              <p>
                Enabled: <strong>{String(state.enabled)}</strong>
              </p>
              <p>
                Healthy: <strong>{String(state.healthy)}</strong>
              </p>
              <p>Last Check: {state.lastCheckAt ?? 'n/a'}</p>
              <p>Last Error: {state.lastError ?? 'none'}</p>
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
  const [message, setMessage] = useState('Hello from CWORK WebUI');
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
      <Panel title="Runtime Console" subtitle="SSE stream, timeline, and final message chain">
        <div className="form-grid">
          <label>
            Session ID (optional)
            <input value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="sess_001" />
          </label>
          <label className="full-span">
            Message
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} />
          </label>
        </div>
        <div className="row">
          <button type="button" onClick={() => void runChat()} disabled={streamStatus === 'running' || message.trim().length === 0}>
            {streamStatus === 'running' ? 'Streaming...' : 'Run Chat'}
          </button>
          <StatusChip ok={streamStatus !== 'failed'} text={streamStatus} />
        </div>
        {streamError ? <p className="error-text">{streamError}</p> : null}
        {finalText ? (
          <div className="output-box">
            <h3>Final Output</h3>
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

      <Panel title="Session Selector" subtitle="Recent sessions from runtime store">
        {sessionsQuery.isLoading ? <p>Loading sessions...</p> : null}
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
        throw new Error(`Invalid variables JSON: ${error instanceof Error ? error.message : String(error)}`);
      }

      const payload: DifyConfig = {
        ...form,
        variables: parsedVariables
      };
      return api.updateDifyConfig(payload);
    },
    onSuccess: async () => {
      setFeedback('Dify configuration updated.');
      setErrorText(null);
      await queryClientInternal.invalidateQueries({ queryKey: ['dify-config'] });
    },
    onError: (error) => {
      setFeedback(null);
      setErrorText(formatError(error));
    }
  });

  return (
    <Panel title="Dify Settings" subtitle="Dify-only provider configuration">
      <div className="form-grid">
        <label>
          Provider ID
          <input value={form.providerId} onChange={(event) => setForm((prev) => ({ ...prev, providerId: event.target.value }))} />
        </label>
        <label>
          API Key
          <input value={form.difyApiKey ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, difyApiKey: event.target.value }))} />
        </label>
        <label>
          API Base
          <input value={form.difyApiBase} onChange={(event) => setForm((prev) => ({ ...prev, difyApiBase: event.target.value }))} />
        </label>
        <label>
          API Type
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
          Workflow Output Key
          <input
            value={form.difyWorkflowOutputKey}
            onChange={(event) => setForm((prev) => ({ ...prev, difyWorkflowOutputKey: event.target.value }))}
          />
        </label>
        <label>
          Query Input Key
          <input
            value={form.difyQueryInputKey}
            onChange={(event) => setForm((prev) => ({ ...prev, difyQueryInputKey: event.target.value }))}
          />
        </label>
        <label>
          Timeout Seconds
          <input
            type="number"
            min={1}
            value={form.timeoutSec}
            onChange={(event) => setForm((prev) => ({ ...prev, timeoutSec: Number(event.target.value) }))}
          />
        </label>
        <label className="full-span">
          Variables JSON
          <textarea value={variablesRaw} onChange={(event) => setVariablesRaw(event.target.value)} rows={6} />
        </label>
      </div>
      <div className="row">
        <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Dify Config'}
        </button>
      </div>
      {feedback ? <p className="success-text">{feedback}</p> : null}
      {errorText ? <p className="error-text">{errorText}</p> : null}
      {difyQuery.data ? <p className="muted-text">Masked key: {difyQuery.data.masked.difyApiKey}</p> : null}
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
    <Panel title="Plugin Manager" subtitle="Local and git plugin lifecycle operations">
      <div className="form-grid">
        <label>
          Import Local Path
          <input value={localPath} onChange={(event) => setLocalPath(event.target.value)} placeholder="/path/to/plugin" />
        </label>
        <div className="row align-end">
          <button
            type="button"
            onClick={() =>
              void runPluginAction(
                () => api.importPluginLocal({ path: localPath }),
                `Imported local plugin from ${localPath}`
              )
            }
            disabled={localPath.trim().length === 0}
          >
            Import Local
          </button>
        </div>
        <label>
          Import Git URL
          <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/org/repo" />
        </label>
        <label>
          Ref
          <input value={repoRef} onChange={(event) => setRepoRef(event.target.value)} placeholder="main" />
        </label>
        <div className="row align-end">
          <button
            type="button"
            onClick={() =>
              void runPluginAction(
                () => api.importPluginGit({ repoUrl, ...(repoRef ? { ref: repoRef } : {}) }),
                `Imported plugin from ${repoUrl}`
              )
            }
            disabled={repoUrl.trim().length === 0}
          >
            Import Git
          </button>
        </div>
      </div>

      {statusText ? <p className="muted-text">{statusText}</p> : null}
      {pluginsQuery.isError ? <p className="error-text">{formatError(pluginsQuery.error)}</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>Plugin</th>
            <th>Status</th>
            <th>Source</th>
            <th>Error</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(pluginsQuery.data?.items ?? []).map((plugin) => (
            <tr key={plugin.pluginId}>
              <td>{plugin.pluginId}</td>
              <td>{plugin.status}</td>
              <td>{plugin.source}</td>
              <td>{plugin.error ?? 'none'}</td>
              <td>
                <div className="inline-actions">
                  <button type="button" onClick={() => void runPluginAction(() => api.enablePlugin(plugin.pluginId), `Enabled ${plugin.pluginId}`)}>
                    Enable
                  </button>
                  <button
                    type="button"
                    onClick={() => void runPluginAction(() => api.disablePlugin(plugin.pluginId), `Disabled ${plugin.pluginId}`)}
                  >
                    Disable
                  </button>
                  <button type="button" onClick={() => void runPluginAction(() => api.reloadPlugin(plugin.pluginId), `Reloaded ${plugin.pluginId}`)}>
                    Reload
                  </button>
                  <button
                    type="button"
                    onClick={() => void runPluginAction(() => api.uninstallPlugin(plugin.pluginId), `Uninstalled ${plugin.pluginId}`)}
                  >
                    Uninstall
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
      <Panel title="Skills" subtitle="Reload, import, toggle, and remove local skills">
        <div className="row">
          <button type="button" onClick={() => void runAction(() => api.reloadSkills(), 'Skills reloaded', refreshSkills)}>
            Reload Skills
          </button>
        </div>
        <div className="form-grid">
          <label>
            Skill ZIP Path
            <input value={skillZipPath} onChange={(event) => setSkillZipPath(event.target.value)} placeholder="/tmp/my-skill.zip" />
          </label>
          <div className="row align-end">
            <button
              type="button"
              onClick={() => void runAction(() => api.importSkill(skillZipPath), `Imported skill ${skillZipPath}`, refreshSkills)}
              disabled={skillZipPath.trim().length === 0}
            >
              Import Skill
            </button>
          </div>
        </div>
        <p className="muted-text">Prompt Block:</p>
        <pre className="compact-pre">{skillsQuery.data?.promptBlock ?? ''}</pre>
        <ul className="simple-list">
          {(skillsQuery.data?.items ?? []).map((skill) => (
            <li key={skill.skillId}>
              <strong>{skill.skillId}</strong> ({skill.scope ?? 'both'}) - enabled: {String(skill.enabled)}
              <div className="inline-actions">
                <button type="button" onClick={() => void runAction(() => api.enableSkill(skill.skillId), `Enabled ${skill.skillId}`, refreshSkills)}>
                  Enable
                </button>
                <button type="button" onClick={() => void runAction(() => api.disableSkill(skill.skillId), `Disabled ${skill.skillId}`, refreshSkills)}>
                  Disable
                </button>
                <button type="button" onClick={() => void runAction(() => api.deleteSkill(skill.skillId), `Deleted ${skill.skillId}`, refreshSkills)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Tools" subtitle="Tool inventory and debug execution">
        <div className="row">
          <button type="button" onClick={() => void runAction(() => api.reloadTools(), 'Tools reloaded', refreshTools)}>
            Reload Tools
          </button>
        </div>
        <div className="form-grid">
          <label>
            Tool Name
            <input value={toolName} onChange={(event) => setToolName(event.target.value)} />
          </label>
          <label>
            Session ID (optional)
            <input value={toolSessionId} onChange={(event) => setToolSessionId(event.target.value)} />
          </label>
          <label className="full-span">
            Arguments JSON
            <textarea value={toolArgs} onChange={(event) => setToolArgs(event.target.value)} rows={4} />
          </label>
        </div>
        <div className="row">
          <button type="button" onClick={() => void executeTool()}>
            Execute Tool
          </button>
        </div>
        <pre className="compact-pre">{toolOutput}</pre>
        <table className="table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Source</th>
              <th>Enabled</th>
              <th>Actions</th>
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
                    <button type="button" onClick={() => void runAction(() => api.enableTool(tool.toolName), `Enabled ${tool.toolName}`, refreshTools)}>
                      Enable
                    </button>
                    <button type="button" onClick={() => void runAction(() => api.disableTool(tool.toolName), `Disabled ${tool.toolName}`, refreshTools)}>
                      Disable
                    </button>
                    <button type="button" onClick={() => void runAction(() => api.deleteTool(tool.toolName), `Deleted ${tool.toolName}`, refreshTools)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Knowledge Base" subtitle="Document CRUD and retrieval">
        <div className="form-grid">
          <label>
            Title
            <input value={docTitle} onChange={(event) => setDocTitle(event.target.value)} />
          </label>
          <label>
            Source (optional)
            <input value={docSource} onChange={(event) => setDocSource(event.target.value)} />
          </label>
          <label className="full-span">
            Content
            <textarea value={docContent} onChange={(event) => setDocContent(event.target.value)} rows={4} />
          </label>
        </div>
        <div className="row">
          <button
            type="button"
            onClick={() =>
              void runAction(
                () => api.createKnowledgeDocument({ title: docTitle, content: docContent, ...(docSource ? { source: docSource } : {}) }),
                `Created document ${docTitle}`,
                refreshDocs
              )
            }
            disabled={docTitle.trim().length === 0 || docContent.trim().length === 0}
          >
            Create Document
          </button>
        </div>
        <div className="form-grid">
          <label>
            Retrieve Query
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
                  'Knowledge retrieved'
                )
              }
            >
              Retrieve
            </button>
          </div>
        </div>
        <pre className="compact-pre">{retrieveResult}</pre>
        <ul className="simple-list">
          {(docsQuery.data?.items ?? []).map((doc) => (
            <li key={doc.docId}>
              <strong>{doc.title}</strong> ({doc.docId})
              <div className="inline-actions">
                <button type="button" onClick={() => void runAction(() => api.deleteKnowledgeDocument(doc.docId), `Deleted ${doc.docId}`, refreshDocs)}>
                  Delete
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
    <Panel title="MCP Management" subtitle="Add / update / test / toggle / delete MCP servers">
      <div className="form-grid">
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Transport
          <select value={transport} onChange={(event) => setTransport(event.target.value as 'stdio' | 'http' | 'sse')}>
            <option value="stdio">stdio</option>
            <option value="http">http</option>
            <option value="sse">sse</option>
          </select>
        </label>
        <label>
          Enabled
          <select value={String(enabled)} onChange={(event) => setEnabled(event.target.value === 'true')}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
        <label>
          Command
          <input value={command} onChange={(event) => setCommand(event.target.value)} />
        </label>
        <label className="full-span">
          Args JSON
          <input value={argsRaw} onChange={(event) => setArgsRaw(event.target.value)} />
        </label>
        <label>
          URL
          <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/mcp" />
        </label>
        <label>
          Timeout Seconds
          <input type="number" value={timeoutSec} min={1} onChange={(event) => setTimeoutSec(Number(event.target.value))} />
        </label>
      </div>
      <div className="row">
        <button type="button" onClick={() => void runAction(() => api.addMcpServer(makePayload()), `Added ${name}`)}>
          Add
        </button>
        <button type="button" onClick={() => void runAction(() => api.updateMcpServer(makePayload()), `Updated ${name}`)}>
          Update
        </button>
        <button type="button" onClick={() => void runAction(() => api.testMcpServer(name), `Tested ${name}`)}>
          Test
        </button>
      </div>
      <p className="muted-text">{statusText}</p>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Transport</th>
            <th>Enabled</th>
            <th>Healthy</th>
            <th>Error</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(mcpQuery.data?.items ?? []).map((server) => (
            <tr key={server.name}>
              <td>{server.name}</td>
              <td>{server.transport}</td>
              <td>{String(server.enabled)}</td>
              <td>{String(server.runtime.healthy)}</td>
              <td>{server.runtime.lastError ?? 'none'}</td>
              <td>
                <div className="inline-actions">
                  <button type="button" onClick={() => void runAction(() => api.enableMcpServer(server.name), `Enabled ${server.name}`)}>
                    Enable
                  </button>
                  <button type="button" onClick={() => void runAction(() => api.disableMcpServer(server.name), `Disabled ${server.name}`)}>
                    Disable
                  </button>
                  <button type="button" onClick={() => void runAction(() => api.deleteMcpServer(server.name), `Deleted ${server.name}`)}>
                    Delete
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
      setStatusText('Subagent configuration updated.');
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
      <Panel title="SubAgent Configuration" subtitle="JSON editor with server-side schema validation">
        <textarea value={configRaw} onChange={(event) => setConfigRaw(event.target.value)} rows={18} className="json-editor" />
        <div className="row">
          <button type="button" onClick={() => void saveConfig()}>
            Save Config
          </button>
        </div>
        <p className="muted-text">{statusText}</p>
      </Panel>

      <Panel title="Available Tools" subtitle="Tool picker source for subagent assignment">
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
    prompt: 'Send my daily summary',
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
      setStatusText(`Created proactive job ${form.name}`);
      await refresh();
    } catch (error) {
      setStatusText(formatError(error));
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      await api.deleteProactiveJob(jobId);
      setStatusText(`Deleted proactive job ${jobId}`);
      await refresh();
    } catch (error) {
      setStatusText(formatError(error));
    }
  };

  return (
    <Panel title="Proactive Jobs" subtitle="Create and remove scheduled jobs">
      <div className="form-grid">
        <label>
          Name
          <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        </label>
        <label>
          Session ID
          <input value={form.sessionId} onChange={(event) => setForm((prev) => ({ ...prev, sessionId: event.target.value }))} />
        </label>
        <label className="full-span">
          Prompt
          <textarea value={form.prompt} onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))} rows={3} />
        </label>
        <label>
          Cron Expression
          <input
            value={form.cronExpression ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, cronExpression: event.target.value || undefined }))}
          />
        </label>
        <label>
          Run At (ISO)
          <input value={form.runAt ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, runAt: event.target.value || undefined }))} />
        </label>
        <label>
          Timezone
          <input
            value={form.timezone ?? ''}
            onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value || undefined }))}
            placeholder="UTC"
          />
        </label>
        <label>
          Run Once
          <select value={String(form.runOnce ?? false)} onChange={(event) => setForm((prev) => ({ ...prev, runOnce: event.target.value === 'true' }))}>
            <option value="false">false</option>
            <option value="true">true</option>
          </select>
        </label>
        <label>
          Enabled
          <select value={String(form.enabled ?? true)} onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.value === 'true' }))}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
      </div>

      <div className="row">
        <button type="button" onClick={() => void createJob()}>
          Create Job
        </button>
      </div>
      <p className="muted-text">{statusText}</p>
      <table className="table">
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Enabled</th>
            <th>Schedule</th>
            <th>Timezone</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {(proactiveQuery.data?.items ?? []).map((job) => (
            <tr key={job.jobId}>
              <td>{job.jobId}</td>
              <td>{job.name}</td>
              <td>{job.status}</td>
              <td>{String(job.enabled)}</td>
              <td>{job.runOnce ? job.runAt ?? 'runOnce' : job.cronExpression ?? 'n/a'}</td>
              <td>{job.timezone ?? 'UTC'}</td>
              <td>
                <button type="button" onClick={() => void deleteJob(job.jobId)}>
                  Delete
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
        <h2>Diagnostics</h2>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </header>
      <p className="muted-text">Request correlation timeline (x-request-id)</p>
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
              status={entry.statusCode} duration={entry.durationMs}ms
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
          <h1>CWORK Operations Console</h1>
          <p>Phase 5 WebUI foundation for runtime, tools, skills, plugins, MCP, subagents, proactive jobs, and diagnostics.</p>
        </div>
        <label className="token-input">
          API Token
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
