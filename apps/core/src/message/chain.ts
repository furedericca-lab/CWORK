import { messagePartSchema, type MessagePart } from '@cwork/shared';
import { z } from 'zod';

const messageChainSchema = z.array(messagePartSchema).min(1);

export const normalizeMessageInput = (input: string | MessagePart[]): MessagePart[] => {
  if (typeof input === 'string') {
    return [{ type: 'plain', text: input }];
  }

  return messageChainSchema.parse(input);
};

export const serializeMessageChain = (parts: MessagePart[]): string => {
  const normalized = messageChainSchema.parse(parts);
  return JSON.stringify(normalized);
};

export const deserializeMessageChain = (raw: string): MessagePart[] => {
  const parsed = JSON.parse(raw) as unknown;
  return messageChainSchema.parse(parsed);
};
