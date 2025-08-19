import fs from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRouters, readFileSafe } from './utils/generate';

// Focus: withMiddleware + withShield wiring

describe('feature: middleware and shield', () => {
  it('wires globalMiddleware and permissions when configured', () => {
    const outDir = generateRouters('middleware');
    // locate createRouter.ts anywhere under outDir to handle generator layout variations
    const stack = [outDir];
    let helpersPath: string | null = null;
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir)) {
        const p = join(dir, entry);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) stack.push(p);
        else if (entry === 'createRouter.ts') {
          helpersPath = p;
          break;
        }
      }
      if (helpersPath) break;
    }
    expect(
      helpersPath,
      'expected createRouter.ts to be generated',
    ).toBeTruthy();
    const content = readFileSafe(helpersPath!);
    // globalMiddleware exported when withMiddleware true/string
    expect(content).toContain('export const globalMiddleware');
    // permissionsMiddleware emitted when withShield enabled
    expect(content).toContain('permissionsMiddleware');
    // ensure shield import path emitted
    expect(content).toMatch(/permissions\)/);
  });
});
