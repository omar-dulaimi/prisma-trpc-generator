import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRouters } from './utils/generate';

// Focus: generator respects custom Prisma Client output paths in imports

describe('feature: custom Prisma Client path', () => {
  it('uses package import when using default Prisma Client', () => {
    const outDir = generateRouters('custom-client-default');

    // Find a Book.router.ts under some routers dir
    const stack = [outDir];
    let bookRouter: string | null = null;
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir)) {
        const p = path.join(dir, entry);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) stack.push(p);
        else if (entry === 'Book.router.ts') bookRouter = p;
      }
      if (bookRouter) break;
    }
    expect(
      bookRouter,
      'expected a Book.router.ts in generated outputs',
    ).toBeTruthy();

    const content = fs.readFileSync(bookRouter!, 'utf8');
    expect(content).toContain('import { Prisma } from "@prisma/client"');
  });

  it('uses relative import when a custom Prisma Client output is configured', () => {
    // Create routers with a custom Prisma Client output by patching the schema at runtime
    // Approach: copy base schema to temp, inject a client generator with output = "./generated/client"
    const repoRoot = process.cwd();
    const prismaDir = path.join(repoRoot, 'prisma');
    const baseSchemaPath = path.join(prismaDir, 'schema.prisma');

    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const tempDir = path.join(
      repoRoot,
      'tests',
      '.tmp',
      `custom-client-${stamp}-${rand}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });

    const schema = fs.readFileSync(baseSchemaPath, 'utf8');
    // Inject a prisma client generator with explicit output, keeping existing one if present
    let patched = schema;
    // Ensure trpc generator provider path points back to repo lib/generator.js from tempDir
    patched = patched.replace(
      /(generator\s+trpc\s*\{[\s\S]*?provider\s*=\s*")node\s+\.\/lib\/generator\.js(")/,
      '$1node ../../../lib/generator.js$2',
    );
    // Ensure trpc generator output to ./generated (insert or replace within the block)
    patched = patched.replace(
      /(generator\s+trpc\s*\{)([\s\S]*?)(\})/,
      (_m, open: string, body: string, close: string) => {
        let newBody = body;
        if (/output\s*=/.test(newBody)) {
          newBody = newBody.replace(
            /(output\s*=\s*)"[^"]+"/,
            '$1"./generated"',
          );
        } else {
          // add a newline if body doesn't end with one
          const sep = newBody.trim().length ? '\n  ' : '\n  ';
          newBody = `${newBody}${sep}output = "./generated"\n`;
        }
        return `${open}${newBody}${close}`;
      },
    );
    // Ensure datasource sqlite url resolves in tempDir
    patched = patched.replace(
      /url\s*=\s*"file:\.\/dev\.db"/,
      'url = "file:./dev.db"',
    );
    // Ensure/patch client generator block safely without corrupting schema
    if (/generator\s+client\s*\{[\s\S]*?\}/.test(patched)) {
      patched = patched.replace(
        /(generator\s+client\s*\{)([\s\S]*?)(\})/,
        (_m, open: string, body: string, close: string) => {
          let newBody = body;
          // ensure provider line exists; if missing, add default
          if (!/provider\s*=/.test(newBody)) {
            const sep = newBody.trim().length ? '\n  ' : '\n  ';
            newBody = `${newBody}${sep}provider = "prisma-client-js"`;
          }
          // add or replace output line
          if (/output\s*=/.test(newBody)) {
            newBody = newBody.replace(
              /(output\s*=\s*)"[^"]+"/,
              '$1"./generated/client"',
            );
          } else {
            newBody = `${newBody}\n  output   = "./generated/client"\n`;
          }
          // ensure body ends with newline and proper indentation
          if (!newBody.endsWith('\n')) newBody += '\n';
          return `${open}${newBody}${close}`;
        },
      );
    } else {
      patched += `\n\ngenerator client {\n  provider = "prisma-client-js"\n  output   = "./generated/client"\n}`;
    }

    // Copy dev.db into tempDir if exists
    const devDbSrc = path.join(prismaDir, 'dev.db');
    const devDbDst = path.join(tempDir, 'dev.db');
    if (fs.existsSync(devDbSrc)) {
      try {
        fs.copyFileSync(devDbSrc, devDbDst);
      } catch {
        /* noop */
      }
    } else {
      try {
        fs.writeFileSync(devDbDst, '');
      } catch {
        /* noop */
      }
    }

    // Write schema
    const tempSchemaPath = path.join(tempDir, 'schema.prisma');
    fs.writeFileSync(tempSchemaPath, patched, 'utf8');

    // Create minimal config to avoid relying on repo-level config
    fs.writeFileSync(
      path.join(tempDir, 'trpc.config.json'),
      JSON.stringify({}, null, 2),
    );

    // Run prisma generate in tempDir
    execSync(`npx prisma generate --schema ${tempSchemaPath}`, {
      cwd: tempDir,
      stdio: 'pipe',
    });

    // Locate Book.router.ts
    const outDir = path.join(tempDir, 'generated');
    const stack = [outDir];
    let bookRouter: string | null = null;
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of fs.readdirSync(dir)) {
        const p = path.join(dir, entry);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) stack.push(p);
        else if (entry === 'Book.router.ts') bookRouter = p;
      }
      if (bookRouter) break;
    }
    expect(
      bookRouter,
      'expected a Book.router.ts in generated outputs',
    ).toBeTruthy();

    const content = fs.readFileSync(bookRouter!, 'utf8');
    // Expect a relative path import for Prisma in this custom client layout
    expect(content).toMatch(
      /import\s+\{\s*Prisma\s*\}\s+from\s+["']\.\.\/.+["']/,
    );
  });
});
