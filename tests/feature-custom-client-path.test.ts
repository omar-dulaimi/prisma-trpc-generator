import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateRouters } from './utils/generate';

// Focus: generator respects custom Prisma Client output paths in imports

describe('feature: custom Prisma Client path', () => {
  // Helper to find Book.router.ts in output directory
  function findBookRouter(outDir: string): string | null {
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
    return bookRouter;
  }

  it('uses relative import with /client suffix for new prisma-client generator', () => {
    // The base schema uses prisma-client with custom output = "../client"
    const outDir = generateRouters('custom-client-default');

    const bookRouter = findBookRouter(outDir);
    expect(
      bookRouter,
      'expected a Book.router.ts in generated outputs',
    ).toBeTruthy();

    const content = fs.readFileSync(bookRouter!, 'utf8');
    // New prisma-client generator requires /client suffix for imports
    expect(content).toMatch(
      /import\s+\{\s*Prisma\s*\}\s+from\s+["']\.\.\/.+\/client["']/,
    );
  });

  it('uses @prisma/client import for legacy prisma-client-js with default path', () => {
    // Create routers with prisma-client-js without custom output
    const repoRoot = process.cwd();
    const prismaDir = path.join(repoRoot, 'prisma');
    const baseSchemaPath = path.join(prismaDir, 'schema.prisma');

    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const tempDir = path.join(
      repoRoot,
      'tests',
      '.tmp',
      `legacy-client-default-${stamp}-${rand}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });

    const schema = fs.readFileSync(baseSchemaPath, 'utf8');
    let patched = schema;

    // Update trpc generator provider path
    patched = patched.replace(
      /(generator\s+trpc\s*\{[\s\S]*?provider\s*=\s*")node\s+\.\/lib\/generator\.js(")/,
      '$1node ../../../lib/generator.js$2',
    );

    // Update trpc generator output
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
          const sep = newBody.trim().length ? '\n  ' : '\n  ';
          newBody = `${newBody}${sep}output = "./generated"\n`;
        }
        return `${open}${newBody}${close}`;
      },
    );

    // Replace client generator with prisma-client-js WITHOUT output (default path)
    patched = patched.replace(
      /generator\s+client\s*\{[\s\S]*?\}/,
      `generator client {
  provider = "prisma-client-js"
}`,
    );

    // Copy dev.db
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

    // Write schema and config files
    const tempSchemaPath = path.join(tempDir, 'schema.prisma');
    fs.writeFileSync(tempSchemaPath, patched, 'utf8');
    fs.writeFileSync(
      path.join(tempDir, 'trpc.config.json'),
      JSON.stringify({}, null, 2),
    );
    fs.writeFileSync(
      path.join(tempDir, 'prisma.config.ts'),
      `import 'dotenv/config';\nimport { defineConfig, env } from 'prisma/config';\n\nexport default defineConfig({\n  schema: './schema.prisma',\n  datasource: {\n    url: env('DATABASE_URL'),\n  },\n});\n`,
    );

    // Run prisma generate
    execSync(`npx prisma generate --schema ${tempSchemaPath}`, {
      cwd: tempDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: 'file:./dev.db',
      },
    });

    // Find and check Book.router.ts
    const outDir = path.join(tempDir, 'generated');
    const bookRouter = findBookRouter(outDir);
    expect(
      bookRouter,
      'expected a Book.router.ts in generated outputs',
    ).toBeTruthy();

    const content = fs.readFileSync(bookRouter!, 'utf8');
    // Legacy prisma-client-js with default path should use @prisma/client
    expect(content).toContain('import { Prisma } from "@prisma/client"');
  });

  it('uses relative import without /client suffix for legacy prisma-client-js with custom output', () => {
    // Create routers with prisma-client-js WITH custom output
    const repoRoot = process.cwd();
    const prismaDir = path.join(repoRoot, 'prisma');
    const baseSchemaPath = path.join(prismaDir, 'schema.prisma');

    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const tempDir = path.join(
      repoRoot,
      'tests',
      '.tmp',
      `legacy-client-custom-${stamp}-${rand}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });

    const schema = fs.readFileSync(baseSchemaPath, 'utf8');
    let patched = schema;

    // Update trpc generator provider path
    patched = patched.replace(
      /(generator\s+trpc\s*\{[\s\S]*?provider\s*=\s*")node\s+\.\/lib\/generator\.js(")/,
      '$1node ../../../lib/generator.js$2',
    );

    // Update trpc generator output
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
          const sep = newBody.trim().length ? '\n  ' : '\n  ';
          newBody = `${newBody}${sep}output = "./generated"\n`;
        }
        return `${open}${newBody}${close}`;
      },
    );

    // Replace client generator with prisma-client-js WITH custom output
    patched = patched.replace(
      /generator\s+client\s*\{[\s\S]*?\}/,
      `generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}`,
    );

    // Copy dev.db
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

    // Write schema and config files
    const tempSchemaPath = path.join(tempDir, 'schema.prisma');
    fs.writeFileSync(tempSchemaPath, patched, 'utf8');
    fs.writeFileSync(
      path.join(tempDir, 'trpc.config.json'),
      JSON.stringify({}, null, 2),
    );
    fs.writeFileSync(
      path.join(tempDir, 'prisma.config.ts'),
      `import 'dotenv/config';\nimport { defineConfig, env } from 'prisma/config';\n\nexport default defineConfig({\n  schema: './schema.prisma',\n  datasource: {\n    url: env('DATABASE_URL'),\n  },\n});\n`,
    );

    // Run prisma generate
    execSync(`npx prisma generate --schema ${tempSchemaPath}`, {
      cwd: tempDir,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: 'file:./dev.db',
      },
    });

    // Find and check Book.router.ts
    const outDir = path.join(tempDir, 'generated');
    const bookRouter = findBookRouter(outDir);
    expect(
      bookRouter,
      'expected a Book.router.ts in generated outputs',
    ).toBeTruthy();

    const content = fs.readFileSync(bookRouter!, 'utf8');
    // Legacy prisma-client-js with custom output should use relative path WITHOUT /client suffix
    expect(content).toMatch(
      /import\s+\{\s*Prisma\s*\}\s+from\s+["']\.\.\/.+["']/,
    );
    // Make sure it does NOT end with /client
    expect(content).not.toMatch(
      /import\s+\{\s*Prisma\s*\}\s+from\s+["']\.\.\/.+\/client["']/,
    );
  });
});
