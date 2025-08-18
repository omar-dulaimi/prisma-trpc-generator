import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exists, generateRouters, readFileSafe } from './utils/generate';

// Focus: Postman collection emission

describe('feature: postman', () => {
  it('emits postman/collection.json when enabled', () => {
    const outDir = generateRouters('postman', { postman: true });
    const postmanPath = join(outDir, 'postman', 'collection.json');
    expect(exists(postmanPath)).toBe(true);
    const content = readFileSafe(postmanPath);
    expect(content).toContain('"info"');
    expect(content).toContain('"item"');
  });
});
