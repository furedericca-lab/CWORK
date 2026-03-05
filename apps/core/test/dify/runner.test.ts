import { describe, expect, it } from 'vitest';
import { DifyRunner } from '../../src/dify/runner';
import { DifyConfigService } from '../../src/dify/dify-config.service';
import { createInMemoryRepositories } from '../../src/repo/memory';
import type { DifyApiClient } from '../../src/dify/api-client';

describe('DifyRunner', () => {
  it('handles chat mode and persists conversation id in next session', async () => {
    const repositories = createInMemoryRepositories();
    const configService = new DifyConfigService(repositories.difyConfig);

    const fakeApiClient = {
      async *chatMessagesStream() {
        yield { event: 'message', delta: 'hello ' };
        yield {
          event: 'message_end',
          conversation_id: 'conv_123',
          metadata: {
            usage: {
              prompt_tokens: 1,
              completion_tokens: 2,
              total_tokens: 3
            }
          }
        };
      }
    } as unknown as DifyApiClient;

    const runner = new DifyRunner(configService, fakeApiClient);

    const result = await runner.run({
      requestId: 'req_1',
      sessionId: 'sess_1',
      request: {
        sessionId: 'sess_1',
        message: 'hello',
        enableStreaming: true
      },
      messageChain: [{ type: 'plain', text: 'hello' }],
      session: {
        sessionId: 'sess_1',
        displayName: 'default',
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        lastActivityAt: '2026-03-05T00:00:00.000Z',
        sessionVariables: {}
      }
    });

    expect(result.events.map((item) => item.event)).toEqual(['delta', 'final_result']);
    expect(result.nextSession.difyConversationId).toBe('conv_123');
  });

  it('supports agent and chatflow mode through text runner path', async () => {
    const repositories = createInMemoryRepositories();

    for (const mode of ['agent', 'chatflow'] as const) {
      await repositories.difyConfig.set({
        providerId: 'default',
        difyApiKey: 'dev-dify-key',
        difyApiBase: 'https://api.dify.ai/v1',
        difyApiType: mode,
        difyWorkflowOutputKey: 'wf_output',
        difyQueryInputKey: 'query',
        timeoutSec: 30,
        variables: {}
      });

      const configService = new DifyConfigService(repositories.difyConfig);
      const fakeApiClient = {
        async *chatMessagesStream() {
          yield { event: 'message', delta: mode };
        }
      } as unknown as DifyApiClient;

      const runner = new DifyRunner(configService, fakeApiClient);
      const result = await runner.run({
        requestId: 'req_2',
        sessionId: 'sess_2',
        request: {
          sessionId: 'sess_2',
          message: 'hello',
          enableStreaming: true
        },
        messageChain: [{ type: 'plain', text: 'hello' }],
        session: {
          sessionId: 'sess_2',
          displayName: 'default',
          createdAt: '2026-03-05T00:00:00.000Z',
          updatedAt: '2026-03-05T00:00:00.000Z',
          lastActivityAt: '2026-03-05T00:00:00.000Z',
          sessionVariables: {}
        }
      });

      expect(result.events.at(-1)).toMatchObject({ event: 'final_result' });
    }
  });

  it('handles workflow output parsing for string and files', async () => {
    const repositories = createInMemoryRepositories();
    await repositories.difyConfig.set({
      providerId: 'default',
      difyApiKey: 'dev-dify-key',
      difyApiBase: 'https://api.dify.ai/v1',
      difyApiType: 'workflow',
      difyWorkflowOutputKey: 'wf_output',
      difyQueryInputKey: 'query',
      timeoutSec: 30,
      variables: {}
    });

    const configService = new DifyConfigService(repositories.difyConfig);
    const fakeApiClient = {
      async *workflowRunStream() {
        yield {
          event: 'workflow_finished',
          data: {
            outputs: {
              wf_output: { answer: 'ok' }
            },
            files: [{ type: 'image', url: 'https://example.com/image.png' }]
          }
        };
      }
    } as unknown as DifyApiClient;

    const runner = new DifyRunner(configService, fakeApiClient);
    const result = await runner.run({
      requestId: 'req_3',
      sessionId: 'sess_3',
      request: {
        sessionId: 'sess_3',
        message: 'run workflow',
        enableStreaming: true
      },
      messageChain: [{ type: 'plain', text: 'run workflow' }],
      session: {
        sessionId: 'sess_3',
        displayName: 'default',
        createdAt: '2026-03-05T00:00:00.000Z',
        updatedAt: '2026-03-05T00:00:00.000Z',
        lastActivityAt: '2026-03-05T00:00:00.000Z',
        sessionVariables: {}
      }
    });

    const final = result.events.find((item) => item.event === 'final_result');
    expect(final).toBeTruthy();
    if (final && final.event === 'final_result') {
      expect(final.data.messageChain[0]).toMatchObject({ type: 'plain' });
      expect(final.data.messageChain[1]).toMatchObject({ type: 'image' });
    }
  });
});
