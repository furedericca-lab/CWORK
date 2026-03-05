import type { FastifyReply } from 'fastify';
import { SseWriter } from './writer';

export const createFastifySseWriter = (reply: FastifyReply): SseWriter => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  return new SseWriter(reply.raw);
};
