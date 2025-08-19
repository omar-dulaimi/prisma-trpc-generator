import fs from 'node:fs';
import path from 'node:path';

function rimrafSafe(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

export default async function () {
  const repoRoot = process.cwd();
  const tmpDir = path.join(repoRoot, 'tests', '.tmp');
  const prismaDir = path.join(repoRoot, 'prisma');
  const cleanPrismaTemps = () => {
    try {
      const entries = fs.readdirSync(prismaDir, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        if (
          /^schema\..+\.prisma$/.test(ent.name) ||
          /^trpc\.config\..+\.json$/.test(ent.name)
        ) {
          try {
            fs.rmSync(path.join(prismaDir, ent.name), { force: true });
          } catch {}
        }
      }
    } catch {}
  };
  // Clean before tests start
  rimrafSafe(tmpDir);
  cleanPrismaTemps();

  // Return teardown to run after all tests finish
  return async () => {
    rimrafSafe(tmpDir);
    cleanPrismaTemps();
  };
}
