import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { TrpcGeneratorTestUtils } from './comprehensive-test-utils';

const baseSchemaPath = path.join(process.cwd(), 'tests', 'schemas', 'basic.prisma');
const base = fs.readFileSync(baseSchemaPath, 'utf-8');

describe('withMiddleware/withShield boolean vs path semantics', () => {
  const outDir = path.join(process.cwd(), 'tests', 'generated', 'basic');

  afterEach(() => {
    TrpcGeneratorTestUtils.cleanup(outDir);
  });

  it('withMiddleware=true uses built-in middleware (no import path)', async () => {
    const schema = base
      .replace('output      = "../generated/basic"', 'output      = "tests/generated/basic"')
      .replace('withShield  = false', 'withShield  = false\n  withMiddleware = true');
    const temp = path.join(process.cwd(), 'temp-mm-true.prisma');
    fs.writeFileSync(temp, schema);
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outDir);
      expect(routers.createRouter).toBeTruthy();
      const content = routers.createRouter || '';
      expect(content).toMatch(/export const globalMiddleware = t\.middleware/);
      expect(content).not.toMatch(/import\s+defaultMiddleware\s+from/);
    } finally {
      fs.unlinkSync(temp);
    }
  });

  it('withMiddleware as string imports that path', async () => {
    const schema = base
      .replace('output      = "../generated/basic"', 'output      = "tests/generated/basic"')
      .replace('withShield  = false', 'withShield  = false\n  withMiddleware = "../test-middleware"');
    const temp = path.join(process.cwd(), 'temp-mm-path.prisma');
    fs.writeFileSync(temp, schema);
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outDir);
      expect(routers.createRouter).toBeTruthy();
  const content = routers.createRouter || '';
  expect(content).toMatch(/import\s+defaultMiddleware\s+from\s+['"]\.\.[^'"]*test-middleware['"]/);
    } finally {
      fs.unlinkSync(temp);
    }
  });

  it('withShield=true wires shield permissions middleware', async () => {
    const schema = base
      .replace('output      = "../generated/basic"', 'output      = "tests/generated/basic"')
      .replace('withShield  = false', 'withShield  = true');
    const temp = path.join(process.cwd(), 'temp-shield-true.prisma');
    fs.writeFileSync(temp, schema);
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outDir);
      expect(routers.createRouter).toBeTruthy();
      const content = routers.createRouter || '';
      expect(content).toMatch(/permissionsMiddleware/);
    } finally {
      fs.unlinkSync(temp);
    }
  });

  it('withShield as string imports permissions from that path', async () => {
    const schema = base
      .replace('output      = "../generated/basic"', 'output      = "tests/generated/basic"')
      .replace('withShield  = false', 'withShield  = "../permissions"');
    const temp = path.join(process.cwd(), 'temp-shield-path.prisma');
    fs.writeFileSync(temp, schema);
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(outDir);
      expect(routers.createRouter).toBeTruthy();
  const content = routers.createRouter || '';
  expect(content).toMatch(/import\s*\{\s*permissions\s*\}\s*from\s*['"]\.\.[^'"]*permissions['"]/);
    } finally {
      fs.unlinkSync(temp);
    }
  });
});
