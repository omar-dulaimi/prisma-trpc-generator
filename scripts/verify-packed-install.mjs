#!/usr/bin/env node
/**
 * End-to-end packaging gate.
 *
 * CI used to prove nothing more than `pnpm pack` exiting zero, which only says a tarball can be
 * written. This packs the same tarball, installs it into an empty project outside the repo, and
 * loads the generator from there, so the run resolves modules exactly the way a stranger's
 * install does.
 *
 * pnpm's isolated node_modules is deliberate: a hoisting installer can satisfy an undeclared
 * dependency out of some unrelated package's subtree, which is how the missing `zod` declaration
 * stayed invisible.
 *
 * Usage: node scripts/verify-packed-install.mjs
 * Requires `./package.sh` to have been run first. Set KEEP_TMP=1 to keep the scratch project.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const packageDir = path.join(repoRoot, 'package');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  });
}

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

if (
  !fs.existsSync(path.join(packageDir, 'lib')) ||
  !fs.existsSync(path.join(packageDir, 'package.json'))
) {
  fail(`No packaged build at ${packageDir}. Run ./package.sh first.`);
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'),
);
const packageName = manifest.name;

// Somewhere outside the repo, so the workspace root and the repo's node_modules cannot be reached
// by Node's upward resolution walk.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ptg-packed-install-'));
const consumer = path.join(scratch, 'consumer');
fs.mkdirSync(consumer);

let exitCode = 0;
try {
  console.log('Packing the publishable directory...');
  run('npm', ['pack', '--pack-destination', scratch, '--silent'], {
    cwd: packageDir,
  });
  // npm names the file deterministically, which is steadier than parsing stdout: npm mixes
  // warnings into it (`.git can't be found`) whenever it is run outside a repository.
  const tarball = path.join(
    scratch,
    `${packageName.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`,
  );
  if (!fs.existsSync(tarball)) fail(`npm pack did not produce ${tarball}`);
  console.log(`Packed ${path.basename(tarball)}`);

  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    `${JSON.stringify({ name: 'packed-install-consumer', version: '0.0.0', private: true }, null, 2)}\n`,
  );

  console.log(`Installing into an empty project at ${consumer} ...`);
  run(
    'pnpm',
    ['add', '--ignore-workspace', '--config.node-linker=isolated', tarball],
    {
      cwd: consumer,
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );

  const installedLib = path.join(consumer, 'node_modules', packageName, 'lib');
  if (!fs.existsSync(installedLib))
    fail(`Installed package has no lib/ at ${installedLib}`);

  // Loading prisma-generator pulls the whole graph: config (zod), project and helpers (ts-morph),
  // plus the two sibling generators, without starting the generator's stdio handler.
  console.log('Loading the generator from the consumer project...');
  run(
    'node',
    ['-e', `require(${JSON.stringify(`${packageName}/lib/prisma-generator`)})`],
    {
      cwd: consumer,
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );

  // The bin entry is what `prisma generate` spawns, so it has to exist and be executable.
  const binRelative =
    typeof manifest.bin === 'string'
      ? manifest.bin
      : Object.values(manifest.bin ?? {})[0];
  if (!binRelative) fail('Manifest declares no bin entry for Prisma to spawn.');
  const binPath = path.join(consumer, 'node_modules', packageName, binRelative);
  if (!fs.existsSync(binPath))
    fail(`Manifest points bin at ${binRelative}, which is not in the tarball.`);

  console.log('\nPacked tarball installs and loads from an empty project. OK');
} catch (error) {
  exitCode = typeof error.status === 'number' ? error.status : 1;
  console.error('\nThe packed tarball does not work from a clean install.');
  console.error(error.message);
} finally {
  if (process.env.KEEP_TMP) {
    console.log(`Scratch project kept at ${scratch}`);
  } else {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

process.exit(exitCode);
