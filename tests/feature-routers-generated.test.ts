import fs from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exists, generateRouters, readFileSafe } from './utils/generate';

// Focus: routers emitted with model files and index

describe('feature: routers generation', () => {
  it('emits index and model routers', () => {
    const outDir = generateRouters('routers');
    // Find a 'routers' directory under outDir (generator may nest differently)
    const stack = [outDir];
    let routersDir: string | null = null;
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir)) {
        const p = join(dir, entry);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          if (entry === 'routers' && exists(join(p, 'index.ts'))) {
            routersDir = p;
            break;
          }
          stack.push(p);
        }
      }
      if (routersDir) break;
    }
    expect(routersDir, 'expected routers directory with index.ts under generated outDir').toBeTruthy();
  expect(exists(join(routersDir!, 'index.ts'))).toBe(true);
  // Based on schema: User.router.ts, Post.router.ts, Book.router.ts should exist
  expect(exists(join(routersDir!, 'User.router.ts'))).toBe(true);
  expect(exists(join(routersDir!, 'Post.router.ts'))).toBe(true);
  expect(exists(join(routersDir!, 'Book.router.ts'))).toBe(true);

  const idx = readFileSafe(join(routersDir!, 'index.ts'));
    expect(idx).toContain('appRouter');
    expect(idx).toContain('createRouter');
  });
});
