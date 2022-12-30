import path from 'path';

export default function getRelativePath(
  outputPath: string,
  filePath: string,
  schemaPath: string,
) {
  const schemaPathSplit = schemaPath.split(path.sep);
  const schemaPathWithoutFileAndExtension = schemaPathSplit
    .slice(0, schemaPathSplit.length - 1)
    .join(path.posix.sep);

  const fromPath = path.join(outputPath, 'routers', 'helpers');
  const toPath = path.join(schemaPathWithoutFileAndExtension, filePath);

  const newPath = path
    .relative(fromPath, toPath)
    .split(path.sep)
    .join(path.posix.sep);

  return newPath;
}
