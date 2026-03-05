import { randomUUID } from 'node:crypto';
import type { KnowledgeDocument, KnowledgeRetrieveItem, KnowledgeRetrieveRequestInput, KnowledgeTaskStatus } from '@cwork/shared';
import { knowledgeDocumentCreateSchema, knowledgeRetrieveRequestSchema } from '@cwork/shared';
import { AppError } from '../../errors/app-error';
import { ERROR_CODE } from '../../errors/error-code';
import type { KnowledgeRepository } from '../../repo/interfaces';

const nowIso = () => new Date().toISOString();

const computeScore = (query: string, content: string): number => {
  const q = query.toLowerCase();
  const c = content.toLowerCase();
  if (!q.trim() || !c.trim()) {
    return 0;
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return 0;
  }

  const hits = tokens.reduce((acc, token) => (c.includes(token) ? acc + 1 : acc), 0);
  return hits / tokens.length;
};

export class KnowledgeManager {
  constructor(private readonly repository: KnowledgeRepository) {}

  health(): { enabled: boolean; healthy: boolean } {
    return {
      enabled: true,
      healthy: true
    };
  }

  async listDocuments(): Promise<KnowledgeDocument[]> {
    return this.repository.listDocuments();
  }

  async createDocument(input: unknown): Promise<{ task: KnowledgeTaskStatus; document: KnowledgeDocument }> {
    const parsed = knowledgeDocumentCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid knowledge document payload', parsed.error.flatten());
    }

    const now = nowIso();
    const doc: KnowledgeDocument = {
      docId: `doc_${randomUUID()}`,
      title: parsed.data.title,
      content: parsed.data.content,
      ...(parsed.data.source ? { source: parsed.data.source } : {}),
      createdAt: now
    };

    const task: KnowledgeTaskStatus = {
      taskId: `kb_task_${randomUUID()}`,
      status: 'processing',
      createdAt: now,
      updatedAt: now
    };
    await this.repository.upsertTask(task);
    await this.repository.upsertDocument(doc);

    const completed: KnowledgeTaskStatus = {
      ...task,
      status: 'completed',
      updatedAt: nowIso()
    };
    await this.repository.upsertTask(completed);

    return { task: completed, document: doc };
  }

  async getTask(taskId: string): Promise<KnowledgeTaskStatus> {
    const found = await this.repository.getTask(taskId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Knowledge task not found: ${taskId}`);
    }
    return found;
  }

  async deleteDocument(docId: string): Promise<void> {
    const found = await this.repository.getDocument(docId);
    if (!found) {
      throw new AppError(ERROR_CODE.NOT_FOUND, `Knowledge document not found: ${docId}`);
    }
    await this.repository.deleteDocument(docId);
  }

  async retrieve(input: unknown): Promise<{ items: KnowledgeRetrieveItem[] }> {
    const parsed = knowledgeRetrieveRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError(ERROR_CODE.VALIDATION_ERROR, 'Invalid knowledge retrieve payload', parsed.error.flatten());
    }

    return this.retrieveByQuery(parsed.data);
  }

  async retrieveByQuery(input: KnowledgeRetrieveRequestInput): Promise<{ items: KnowledgeRetrieveItem[] }> {
    const docs = await this.repository.listDocuments();
    const scored = docs
      .map((doc) => ({
        doc,
        score: computeScore(input.query, `${doc.title}\n${doc.content}`)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.topK);

    const items: KnowledgeRetrieveItem[] = scored.map(({ doc, score }) => ({
      docId: doc.docId,
      title: doc.title,
      snippet: doc.content.slice(0, 220),
      score,
      citation: doc.source ?? `kb:${doc.docId}`
    }));

    return { items };
  }
}
