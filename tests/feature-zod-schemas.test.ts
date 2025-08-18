import fs from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRouters, readFileSafe } from './utils/generate';

// Focus: withZod true generates schemas per model

describe('feature: zod schemas', () => {
  it('generates zod schema outputs when withZod is enabled', () => {
    const outDir = generateRouters('zod', { withZod: true });
    // Recursively look for a schemas directory containing *.schema.ts
    const stack = [outDir];
    let foundSchemasDir: string | null = null;
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir)) {
        const p = join(dir, entry);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          if (entry === 'schemas') {
            const hasSchemaFiles = fs.readdirSync(p).some(f => f.endsWith('.schema.ts'));
            if (hasSchemaFiles) {
              foundSchemasDir = p;
              break;
            }
          }
          stack.push(p);
        }
      }
      if (foundSchemasDir) break;
    }

    if (foundSchemasDir) {
      const files = fs.readdirSync(foundSchemasDir).filter(f => f.endsWith('.schema.ts'));
      expect(files.length).toBeGreaterThan(0);
    } else {
      // Fallback: ensure at least one router imports from a ../schemas path
      const routerCandidates: string[] = [];
      // collect a few router files
      const stack2 = [outDir];
      while (stack2.length && routerCandidates.length < 3) {
        const dir = stack2.pop()!;
        for (const entry of fs.readdirSync(dir)) {
          const p = join(dir, entry);
          const stat = fs.statSync(p);
          if (stat.isDirectory()) stack2.push(p);
          else if (entry.endsWith('.router.ts')) routerCandidates.push(p);
        }
      }
      expect(routerCandidates.length > 0).toBe(true);
      const content = readFileSafe(routerCandidates[0]);
      expect(content).toMatch(/from\s+['"]\.\.\/schemas\//);
    }
  });
});
