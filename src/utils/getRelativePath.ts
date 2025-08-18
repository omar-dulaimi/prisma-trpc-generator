import path from 'path';

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
    toPath = path.isAbsolute(filePath) ? filePath : path.join(schemaDir, filePath);
  }

  const newPath = path
    .relative(fromPath, toPath)
    .split(path.sep)
    .join(path.posix.sep);

  return newPath;
}
