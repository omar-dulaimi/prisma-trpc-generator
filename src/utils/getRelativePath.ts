import path from 'path';

/**
 * Extension appended to every emitted relative import, e.g. `.js`.
 *
 * Under `moduleResolution: nodenext`, or when running TypeScript directly in Node, an extensionless
 * relative import does not resolve. Rather than inventing an option, this follows the same knob the
 * `prisma-client` generator block already exposes, which is also what prisma-zod-generator reads for
 * the schema files this generator emits alongside these. One setting, one behaviour across both.
 */
let importFileExtension = '';

/** Appends the configured extension to a specifier written literally rather than computed. */
export function withImportExtension(specifier: string): string {
  return specifier + importFileExtension;
}

/** Set once per run, before anything is emitted. */
export function setImportFileExtension(extension: string | undefined): void {
  if (!extension) {
    importFileExtension = '';
    return;
  }
  importFileExtension = extension.startsWith('.') ? extension : `.${extension}`;
}

export default function getRelativePath(
  outputPath: string,
  filePath: string,
  isOutsideOutputPath?: boolean,
  schemaPath?: string,
) {
  const fromPath = path.join(outputPath, 'routers', 'helpers');
  let toPath = filePath;

  // If an absolute path is provided, respect it directly
  if (!path.isAbsolute(toPath)) {
    // Resolve relative to output by default
    toPath = path.join(outputPath, filePath);
  }

  if (isOutsideOutputPath && schemaPath) {
    // Explicitly resolve relative imports (e.g., '../permissions', '../test-context')
    const schemaDir = path.dirname(schemaPath);
    toPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(schemaDir, filePath);
  }

  const newPath = path
    .relative(fromPath, toPath)
    .split(path.sep)
    .join(path.posix.sep);

  return newPath + importFileExtension;
}
