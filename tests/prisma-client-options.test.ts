import fs from 'fs';
import { join, resolve } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { TrpcGeneratorTestUtils } from './comprehensive-test-utils';

describe('prisma-client options matrix', () => {
  const testOutputDir = join(process.cwd(), 'tests', 'generated', 'options');

  afterAll(() => {
    TrpcGeneratorTestUtils.cleanup(testOutputDir);
  });

  const base = `
datasource db {
  provider = "postgresql"
  url      = "postgresql://user:pass@localhost:5432/db"
}

generator trpc {
  provider    = "node ../../lib/generator.js"
  output      = "tests/generated/options"
  contextPath = "../test-context"
  withZod     = true
  withShield  = false
}

model A {
  id   Int    @id @default(autoincrement())
  name String
}
`;

  it('supports moduleFormat/runtime combos and absolute client output', async () => {
    const absClientOutput = resolve(process.cwd(), 'tests/generated/options/client-abs');
    const schema = `generator client {\n  provider = "prisma-client"\n  output = "${absClientOutput.replace(/\\\\/g, '/')}"\n  moduleFormat = "esm"\n  runtime = "nodejs"\n  generatedFileExtension = "ts"\n  importFileExtension = "ts"\n}\n\n${base}`;

    const temp = join(process.cwd(), 'temp-client-options-abs.prisma');
    fs.writeFileSync(temp, schema);
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      expect(routers.appRouter).toBeTruthy();
      expect(routers.createRouter).toBeTruthy();
      expect(routers.modelRouters['A']).toBeTruthy();
    } finally {
      fs.unlinkSync(temp);
    }
  });

  it('supports cjs moduleFormat and default file extensions', async () => {
    const schema = `generator client {\n  provider = "prisma-client"\n  output = "tests/generated/options/client-cjs"\n  moduleFormat = "cjs"\n}\n\n${base}`;
    const temp = join(process.cwd(), 'temp-client-options-cjs.prisma');
    fs.writeFileSync(temp, schema);
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      expect(routers.appRouter).toBeTruthy();
      expect(routers.modelRouters['A']).toBeTruthy();
    } finally {
      fs.unlinkSync(temp);
    }
  });

  it('supports generated/import file extensions and engine/binary settings', async () => {
    const schema = `generator client {\n  provider = "prisma-client"\n  output = "tests/generated/options/client-ext"\n  moduleFormat = "esm"\n  runtime = "nodejs"\n  generatedFileExtension = "mts"\n  importFileExtension = "js"\n  binaryTargets = ["native"]\n  engineType = "library"\n}\n\n${base}`;
    const temp = join(process.cwd(), 'temp-client-options-ext-engine.prisma');
    fs.writeFileSync(temp, schema);
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      expect(routers.appRouter).toBeTruthy();
      expect(routers.createRouter).toBeTruthy();
      expect(routers.modelRouters['A']).toBeTruthy();
    } finally {
      fs.unlinkSync(temp);
    }
  });

  it('supports edge-light runtime without affecting generation', async () => {
    const schema = `generator client {\n  provider = "prisma-client"\n  output = "tests/generated/options/client-edge"\n  runtime = "edge-light"\n  moduleFormat = "esm"\n}\n\n${base}`;
    const temp = join(process.cwd(), 'temp-client-options-edge.prisma');
    fs.writeFileSync(temp, schema);
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      expect(routers.appRouter).toBeTruthy();
      expect(routers.modelRouters['A']).toBeTruthy();
    } finally {
      fs.unlinkSync(temp);
    }
  });

  it('supports prisma client output path ../src/generated/prisma', async () => {
    const schema = `generator client {\n  provider = "prisma-client"\n  output = "../src/generated/prisma"\n}\n\n${base}`;
    const temp = join(process.cwd(), 'temp-client-options-src-generated.prisma');
    fs.writeFileSync(temp, schema);
    const prismaClientOut = resolve(process.cwd(), 'src/generated/prisma');
    try {
      await TrpcGeneratorTestUtils.generateRouters(temp);
      const routers = TrpcGeneratorTestUtils.readGeneratedRouters(testOutputDir);
      expect(routers.appRouter).toBeTruthy();
      expect(routers.createRouter).toBeTruthy();
      expect(routers.modelRouters['A']).toBeTruthy();
    } finally {
      fs.unlinkSync(temp);
  try { fs.rmSync(prismaClientOut, { recursive: true, force: true }); } catch {
        // ignore cleanup error
      }
    }
  });
});
