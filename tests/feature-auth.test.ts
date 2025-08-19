import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exists, generateRouters, readFileSafe } from './utils/generate';

// Focus: auth presets integration (public/protected/role exports and helper wiring)

describe('feature: auth presets', () => {
  it('emits public/protected helpers when auth enabled', () => {
    const outDir = generateRouters('auth');
    const helpersPath = join(outDir, 'routers', 'helpers', 'createRouter.ts');
    expect(exists(helpersPath)).toBe(true);
    const content = readFileSafe(helpersPath);
    // Expect publicProcedure always, protectedProcedure when auth or middleware present in config
    expect(content).toContain('export const publicProcedure');
    // protectedProcedure appears twice in generator in some branches; check presence at least
    expect(content).toContain('protectedProcedure');
    // If a dedicated auth.ts helper isn't emitted, createRouter should still expose protectedProcedure
    // so we don't require a specific auth.ts file path here.
  });
});
