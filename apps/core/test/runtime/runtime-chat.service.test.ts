import { describe, expect, it } from 'vitest';
import { RuntimeChatService } from '../../src/runtime/runtime-chat.service';
import { createInMemoryRepositories } from '../../src/repo/memory';
import { SseWriter } from '../../src/sse/writer';
import type { DifyApiClient } from '../../src/dify/api-client';

const createNoopWriter = () =>
  new SseWriter({
    write: () => undefined,
    end: () => undefined
  });

describe('RuntimeChatService', () => {
  it('reuses conversation id for same session and isolates sessions', async () => {
    const repositories = createInMemoryRepositories();
    const conversationBySession = new Map<string, string>();

    const fakeApiClient = {
      async *chatMessagesStream(request: { payload: Record<string, unknown> }) {
        const sessionId = String(request.payload.user);
        const incomingConversation =
          typeof request.payload.conversation_id === 'string' ? request.payload.conversation_id : undefined;

        const nextConversation = incomingConversation ?? `conv_${sessionId}`;
        conversationBySession.set(sessionId, nextConversation);

        yield { event: 'message', delta: `hello_${sessionId}` };
        yield { event: 'message_end', conversation_id: nextConversation };
      }
    } as unknown as DifyApiClient;

    const service = new RuntimeChatService(repositories, fakeApiClient);

    await service.run({
      requestId: 'req_1',
      request: { sessionId: 'sess_a', message: 'hello a', enableStreaming: true },
      writer: createNoopWriter()
    });

    await service.run({
      requestId: 'req_2',
      request: { sessionId: 'sess_a', message: 'hello a again', enableStreaming: true },
      writer: createNoopWriter()
    });

    await service.run({
      requestId: 'req_3',
      request: { sessionId: 'sess_b', message: 'hello b', enableStreaming: true },
      writer: createNoopWriter()
    });

    const sessionA = await repositories.sessions.findById('sess_a');
    const sessionB = await repositories.sessions.findById('sess_b');

    expect(sessionA?.difyConversationId).toBe('conv_sess_a');
    expect(sessionB?.difyConversationId).toBe('conv_sess_b');
    expect(conversationBySession.get('sess_a')).toBe('conv_sess_a');
    expect(conversationBySession.get('sess_b')).toBe('conv_sess_b');
  });
});
