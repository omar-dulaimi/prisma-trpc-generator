import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { join } from 'node:path';

export type GenOverrides = Partial<{
  withZod: boolean;
  withShield: boolean | string;
  withMiddleware: boolean | string;
  auth: boolean;
  postman: boolean;
  openapi: boolean;
}>;

/**
 * Run prisma generate in the repo prisma folder using an isolated output dir per invocation.
 * Returns the absolute path to the generated output directory.
 */
export function generateRouters(suiteName = 'feature', overrides: GenOverrides = {}) {
  const repoRoot = process.cwd();
  const prismaDir = join(repoRoot, 'prisma');
  const baseSchemaPath = join(prismaDir, 'schema.prisma');

  // Create a unique temp working directory for this test under tests/.tmp/<suite>-<stamp>-<rand>
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const tempDir = join(repoRoot, 'tests', '.tmp', `${suiteName}-${stamp}-${rand}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // Ensure output dir is clean inside tempDir
  const outDir = join(tempDir, 'generated');
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}

  // Copy dev.db if exists so sqlite datasource works relative to tempDir
  const devDbSrc = join(prismaDir, 'dev.db');
  const devDbDst = join(tempDir, 'dev.db');
  if (fs.existsSync(devDbSrc)) {
    try { fs.copyFileSync(devDbSrc, devDbDst); } catch {}
  } else {
    // ensure directory exists even if db missing
    try { fs.writeFileSync(devDbDst, ''); } catch {}
  }

  // Prepare patched schema in tempDir
  const original = fs.readFileSync(baseSchemaPath, 'utf8');
  let patched = original;
  // Fix generator provider path relative to tempDir (schema is at tests/.tmp/...)
  patched = patched.replace(
    /provider\s*=\s*"node\s+\.\/lib\/generator\.js"/,
    'provider = "node ../../../lib/generator.js"',
  );
  // Override output path to the temp outDir (stable path ./generated)
  if (/output\s*=\s*"[^"]+"/.test(patched)) {
    patched = patched.replace(/output\s*=\s*"[^"]+"/, 'output = "./generated"');
  } else {
    // insert output if missing inside generator block
    patched = patched.replace(/(generator\s+trpc\s*\{)/, '$1\n  output = "./generated"');
  }
  // Adjust datasource url to point to local dev.db in tempDir when using sqlite
  patched = patched.replace(/url\s*=\s*"file:\.\/dev\.db"/, 'url = "file:./dev.db"');

  // Merge config overrides and write config into tempDir
  const baseConfigPath = join(prismaDir, 'trpc.config.json');
  let tempConfigPath: string | null = null;
  try {
    const baseConfig = fs.existsSync(baseConfigPath)
      ? JSON.parse(fs.readFileSync(baseConfigPath, 'utf8'))
      : {};
    const merged = { ...baseConfig, ...overrides };
    tempConfigPath = join(tempDir, 'trpc.config.json');
    fs.writeFileSync(tempConfigPath, JSON.stringify(merged, null, 2), 'utf8');
    // Point schema to use the temp config within tempDir
    if (/config\s*=\s*"[^"]+"/.test(patched)) {
      patched = patched.replace(/config\s*=\s*"[^"]+"/, 'config = "./trpc.config.json"');
    } else {
      patched = patched.replace(/(generator\s+trpc\s*\{)/, '$1\n  config = "./trpc.config.json"');
    }
  } catch {
    // ignore
  }

  // Write schema.prisma into tempDir
  const tempSchemaPath = join(tempDir, 'schema.prisma');
  fs.writeFileSync(tempSchemaPath, patched, 'utf8');

  // Run prisma generate in the tempDir
  try {
    execSync(`npx prisma generate --schema ${tempSchemaPath}`, { stdio: 'pipe', cwd: tempDir });
  } finally {
    // keep tempDir for test inspection; clean only ephemeral config if any external left
    if (tempConfigPath && !fs.existsSync(tempDir)) {
      try { fs.unlinkSync(tempConfigPath); } catch {}
    }
  }

  return outDir;
}

export function readFileSafe(p: string) {
  return fs.readFileSync(p, 'utf8');
}

export function exists(p: string) {
  return fs.existsSync(p);
}
