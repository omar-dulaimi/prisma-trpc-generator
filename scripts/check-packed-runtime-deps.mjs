#!/usr/bin/env node
/**
 * Static packaging gate.
 *
 * The test suites run the built `lib/` from inside this repo, so it resolves modules through the
 * repo's own `node_modules`, where devDependencies are present. A consumer who installs the
 * published tarball gets only what `dependencies` declares. Anything the build requires but the
 * manifest does not declare therefore works here and fails there.
 *
 * This script compares the two directly: what the compiled output loads, against what the
 * manifest that actually ships promises will be installed.
 *
 * Usage: node scripts/check-packed-runtime-deps.mjs [packageRoot]
 * Defaults to `package/` when it has been built, otherwise the repo root.
 */
import { builtinModules } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const BUILTINS = new Set(builtinModules);

/**
 * A bare specifier as npm accepts it: optional scope, then a package name, then an optional
 * subpath. This deliberately rejects anything containing template-literal syntax, spaces or
 * parentheses, because the generator writes import statements into the code it emits and those
 * specifiers live inside string literals in the build output. They are the consumer's imports,
 * not this package's.
 */
const BARE_SPECIFIER =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9._-]*)*$/;

/** Reduce a module specifier to the package name that must appear in the manifest. */
function toPackageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function isExternal(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return false;
  if (specifier.startsWith('node:')) return false;
  if (!BARE_SPECIFIER.test(specifier)) return false;
  return !BUILTINS.has(toPackageName(specifier));
}

function collectJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsFiles(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * The build is CommonJS (tsconfig `module: commonjs`), so every real module load is a call.
 * Bare `import ... from` lines in these files are strings destined for generated code.
 */
const LOAD_PATTERNS = [
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /(?<!\.)\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/** Tripwire: if the build ever stops being CommonJS, `require` scanning would silently pass. */
function assertCommonJsBuild(files) {
  const notCommonJs = files.filter((file) => {
    const source = fs.readFileSync(file, 'utf8');
    if (/\brequire\(/.test(source) || /\bexports\b/.test(source)) return false;
    return /^\s*(?:import|export)\s/m.test(source);
  });
  if (notCommonJs.length > 0) {
    console.error(
      'Build output is no longer CommonJS, so scanning require() calls is not enough:',
    );
    for (const file of notCommonJs)
      console.error(`  - ${path.relative(repoRoot, file)}`);
    console.error(
      'Teach this check to parse ESM imports before trusting it again.',
    );
    process.exit(1);
  }
}

function collectExternalSpecifiers(files) {
  /** @type {Map<string, Set<string>>} package name -> specifiers seen */
  const found = new Map();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of LOAD_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const specifier = match[1];
        if (!isExternal(specifier)) continue;
        const name = toPackageName(specifier);
        if (!found.has(name)) found.set(name, new Set());
        found.get(name).add(specifier);
      }
    }
  }
  return found;
}

function resolvePackageRoot(argv) {
  if (argv[0]) return path.resolve(argv[0]);
  const packaged = path.join(repoRoot, 'package');
  const hasPackaged =
    fs.existsSync(path.join(packaged, 'lib')) &&
    fs.existsSync(path.join(packaged, 'package.json'));
  return hasPackaged ? packaged : repoRoot;
}

function main() {
  const packageRoot = resolvePackageRoot(process.argv.slice(2));
  const libDir = path.join(packageRoot, 'lib');
  const manifestPath = path.join(packageRoot, 'package.json');

  if (!fs.existsSync(libDir)) {
    console.error(
      `No build output at ${libDir}. Run \`pnpm run build\` (or \`./package.sh\`) before this check.`,
    );
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);

  const files = collectJsFiles(libDir);
  if (files.length === 0) {
    console.error(
      `No .js files under ${libDir}. The build produced nothing to publish.`,
    );
    process.exit(1);
  }
  assertCommonJsBuild(files);

  const required = collectExternalSpecifiers(files);
  const undeclared = [...required.keys()]
    .filter((name) => !declared.has(name))
    .sort();
  const unused = [...declared].filter((name) => !required.has(name)).sort();

  console.log(
    `Checking ${files.length} built files in ${path.relative(repoRoot, libDir) || libDir}`,
  );
  console.log(
    `Runtime modules loaded by the build: ${[...required.keys()].sort().join(', ')}`,
  );

  if (unused.length > 0) {
    console.log(
      `Note: declared but never loaded by the build: ${unused.join(', ')}`,
    );
  }

  if (undeclared.length > 0) {
    console.error('');
    console.error('Missing runtime dependencies in the published manifest:');
    for (const name of undeclared) {
      const specifiers = [...required.get(name)].sort().join(', ');
      console.error(`  - ${name}   (loaded as: ${specifiers})`);
    }
    console.error('');
    console.error(
      'A consumer installing the tarball into an empty project gets only `dependencies`,',
    );
    console.error(
      'so these resolve by hoisting luck or not at all. Move them out of devDependencies.',
    );
    process.exit(1);
  }

  console.log('All runtime modules loaded by the build are declared. OK');
}

main();
