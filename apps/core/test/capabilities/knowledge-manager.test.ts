import { describe, expect, it } from 'vitest';
import { KnowledgeManager } from '../../src/capabilities/knowledge/manager';
import { createInMemoryRepositories } from '../../src/repo/memory';

describe('KnowledgeManager', () => {
  it('creates documents and retrieves scored snippets', async () => {
    const repositories = createInMemoryRepositories();
    const manager = new KnowledgeManager(repositories.knowledge);

    const created = await manager.createDocument({
      title: 'AstrBot Refactor',
      content: 'CWORK uses Dify provider and runtime pipeline.',
      source: 'internal-doc'
    });
    expect(created.task.status).toBe('completed');

    const retrieved = await manager.retrieve({ query: 'Dify runtime', topK: 3 });
    expect(retrieved.items.length).toBeGreaterThan(0);
    expect(retrieved.items[0]?.citation).toContain('internal-doc');
  });
});
