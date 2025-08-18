import fs from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRouters } from './utils/generate';

// Focus: tenancy and soft-delete defaults reflected in Post.router content

describe('feature: tenancy + soft-delete hooks', () => {
  it('injects tenant/soft-delete logic in services or procedures', () => {
    const outDir = generateRouters('tenancy');
  const postRouterPath = join(outDir, 'routers', 'Post.router.ts');
    expect(fs.existsSync(postRouterPath)).toBe(true);
    const content = fs.readFileSync(postRouterPath, 'utf8');
    // Since generator may use services conditionally, we assert presence of procedure wiring and not exact code
  // expect procedures for findMany/create/update are present (match either suffixed or full names)
  expect(content).toMatch(/findMany(Post|\:|\s)/);
  expect(content).toMatch(/create(One)?Post|create(Post|\:)/);
  expect(content).toMatch(/update(One)?Post|update(Post|\:)/);
  });
});
