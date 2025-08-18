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
  // Clean before tests start
  rimrafSafe(tmpDir);

  // Return teardown to run after all tests finish
  return async () => {
    rimrafSafe(tmpDir);
  };
}
