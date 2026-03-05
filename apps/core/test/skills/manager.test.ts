import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryRepositories } from '../../src/repo/memory';
import { SkillManager } from '../../src/skills/manager';

const tempDirs: string[] = [];

const createTempDir = async (prefix: string) => {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('SkillManager', () => {
  it('imports zip with sanitization and supports lifecycle operations', async () => {
    const rootDir = await createTempDir('cwork-skill-root-');
    const zipDir = await createTempDir('cwork-skill-zip-');
    const zipPath = join(zipDir, 'skill.zip');
    await writeFile(zipPath, 'fake zip payload', 'utf8');

    const repositories = createInMemoryRepositories();
    const manager = new SkillManager(repositories.skills, {
      rootDir,
      listArchiveEntries: async () => ['demo-skill/', 'demo-skill/SKILL.md', 'demo-skill/skill.json'],
      extractArchive: async (_zipPath, destination) => {
        await mkdir(join(destination, 'demo-skill'), { recursive: true });
        await writeFile(join(destination, 'demo-skill', 'SKILL.md'), '# demo', 'utf8');
        await writeFile(
          join(destination, 'demo-skill', 'skill.json'),
          JSON.stringify({ name: 'Demo Skill', description: 'desc', scope: 'both' }),
          'utf8'
        );
      }
    });

    const imported = await manager.importZip(zipPath);
    expect(imported).toMatchObject({ skillId: 'demo-skill', enabled: true });

    const disabled = await manager.disable('demo-skill');
    expect(disabled.enabled).toBe(false);

    const enabled = await manager.enable('demo-skill');
    expect(enabled.enabled).toBe(true);

    const prompt = await manager.buildPromptBlock();
    expect(prompt).toContain('demo-skill');

    await manager.delete('demo-skill');
    expect(await manager.list()).toHaveLength(0);
  });

  it('rejects malicious or invalid archive layout', async () => {
    const rootDir = await createTempDir('cwork-skill-root-');
    const zipDir = await createTempDir('cwork-skill-zip-');
    const zipPath = join(zipDir, 'skill.zip');
    await writeFile(zipPath, 'fake zip payload', 'utf8');

    const repositories = createInMemoryRepositories();

    const managerPathTraversal = new SkillManager(repositories.skills, {
      rootDir,
      listArchiveEntries: async () => ['../evil.txt'],
      extractArchive: async () => undefined
    });

    await expect(managerPathTraversal.importZip(zipPath)).rejects.toThrow(/Unsafe archive entry/);

    const managerMultiRoot = new SkillManager(repositories.skills, {
      rootDir,
      listArchiveEntries: async () => ['a/file.txt', 'b/file.txt'],
      extractArchive: async () => undefined
    });

    await expect(managerMultiRoot.importZip(zipPath)).rejects.toThrow(/single root folder/);
  });

  it('enforces sandbox_only enable constraint when sandbox is disabled', async () => {
    const rootDir = await createTempDir('cwork-skill-root-');
    const zipDir = await createTempDir('cwork-skill-zip-');
    const zipPath = join(zipDir, 'sandbox-skill.zip');
    await writeFile(zipPath, 'fake zip payload', 'utf8');

    const repositories = createInMemoryRepositories();
    const manager = new SkillManager(repositories.skills, {
      rootDir,
      sandboxEnabled: false,
      listArchiveEntries: async () => ['sandbox-skill/', 'sandbox-skill/SKILL.md', 'sandbox-skill/skill.json'],
      extractArchive: async (_zipPath, destination) => {
        await mkdir(join(destination, 'sandbox-skill'), { recursive: true });
        await writeFile(join(destination, 'sandbox-skill', 'SKILL.md'), '# sandbox', 'utf8');
        await writeFile(
          join(destination, 'sandbox-skill', 'skill.json'),
          JSON.stringify({ name: 'Sandbox Skill', scope: 'sandbox_only' }),
          'utf8'
        );
      }
    });

    const imported = await manager.importZip(zipPath);
    expect(imported).toMatchObject({ skillId: 'sandbox-skill', enabled: false, scope: 'sandbox_only' });
    await expect(manager.enable('sandbox-skill')).rejects.toThrow(/requires sandbox mode/);
  });
});
