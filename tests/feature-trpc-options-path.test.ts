import fs from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRouters, readFileSafe } from './utils/generate';

describe('feature: trpcOptionsPath', () => {
  it('does not import trpcOptions when trpcOptionsPath is omitted', () => {
    const outDir = generateRouters('trpc-options-path', {
      trpcOptionsPath: undefined,
    });
    const helpersPath = join(outDir, 'routers', 'helpers', 'createRouter.ts');
    expect(fs.existsSync(helpersPath)).toBe(true);
    const content = readFileSafe(helpersPath);
    expect(content).not.toContain('import trpcOptions');
    expect(content).toContain('initTRPC.context<Context>().create()');
  });
});
