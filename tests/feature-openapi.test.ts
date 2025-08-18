import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exists, generateRouters, readFileSafe } from './utils/generate';

// Focus: OpenAPI document emission

describe('feature: openapi', () => {
  it('emits openapi/openapi.json when enabled', () => {
    const outDir = generateRouters('openapi', { openapi: true });
    const openapiPath = join(outDir, 'openapi', 'openapi.json');
    expect(exists(openapiPath)).toBe(true);
    const content = readFileSafe(openapiPath);
    expect(content).toContain('"openapi"');
    expect(content).toContain('"paths"');
  });
});
