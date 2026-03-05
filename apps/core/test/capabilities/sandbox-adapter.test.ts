import { describe, expect, it } from 'vitest';
import { SandboxAdapter } from '../../src/capabilities/sandbox/adapter';

describe('SandboxAdapter', () => {
  it('exposes tools only in sandbox mode and executes commands', async () => {
    const disabled = new SandboxAdapter({ mode: 'none' });
    expect(disabled.buildTools()).toHaveLength(0);

    const enabled = new SandboxAdapter({ mode: 'sandbox', timeoutMs: 2_000 });
    const tools = enabled.buildTools();
    expect(tools.map((item) => item.meta.toolName)).toContain('sandbox.exec');

    const execTool = tools.find((item) => item.meta.toolName === 'sandbox.exec');
    if (!execTool) {
      throw new Error('sandbox.exec tool missing');
    }

    const result = await execTool.handler({ command: 'echo hello_sandbox' }, { requestId: 'req_1' });
    expect(result).toMatchObject({ stdout: expect.stringContaining('hello_sandbox') });
  });
});
