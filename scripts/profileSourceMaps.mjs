import { readFile } from 'node:fs/promises';
import { SourceMap } from 'node:module';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoPackages = resolve(import.meta.dirname, '../packages');
const sourceMaps = new Map();

export function bundlePath(url) {
  let path;
  try {
    path = url?.startsWith('file:') ? fileURLToPath(url) : url;
  } catch {
    return undefined;
  }
  if (!path || !isAbsolute(path) || !path.endsWith('.js')) return undefined;

  const packageRelativePath = relative(repoPackages, path);
  if (packageRelativePath.startsWith('..') || isAbsolute(packageRelativePath)) return undefined;
  if (!packageRelativePath.split(sep).includes('dist')) return undefined;
  return path;
}

export async function loadSourceMap(path) {
  if (!sourceMaps.has(path)) {
    sourceMaps.set(
      path,
      (async () => {
        try {
          return new SourceMap(JSON.parse(await readFile(`${path}.map`, 'utf8')));
        } catch (error) {
          console.warn(`Could not read source map ${path}.map: ${error.message}`);
          return undefined;
        }
      })()
    );
  }
  return sourceMaps.get(path);
}

export function mapLocation(sourceMap, path, lineNumber, columnNumber) {
  if (
    !sourceMap ||
    !Number.isInteger(lineNumber) ||
    !Number.isInteger(columnNumber) ||
    lineNumber < 0 ||
    columnNumber < 0
  )
    return undefined;
  const entry = sourceMap.findEntry(lineNumber, columnNumber);
  if (!entry.originalSource) return undefined;
  return {
    url: new URL(entry.originalSource, pathToFileURL(`${path}.map`)).href,
    lineNumber: entry.originalLine,
    columnNumber: entry.originalColumn
  };
}

export async function remapCallFrames(frames) {
  const framesByBundle = new Map();
  for (const frame of frames) {
    const path = bundlePath(frame?.url);
    if (!path || frame.lineNumber < 0 || frame.columnNumber < 0) continue;
    const bundleFrames = framesByBundle.get(path) ?? [];
    bundleFrames.push(frame);
    framesByBundle.set(path, bundleFrames);
  }

  let mappedFrames = 0;
  let mappedBundles = 0;
  for (const [path, bundleFrames] of framesByBundle) {
    const sourceMap = await loadSourceMap(path);
    let bundleMapped = false;
    for (const frame of bundleFrames) {
      const mapped = mapLocation(sourceMap, path, frame.lineNumber, frame.columnNumber);
      if (!mapped) continue;
      Object.assign(frame, mapped);
      mappedFrames++;
      bundleMapped = true;
    }
    if (bundleMapped) mappedBundles++;
  }

  return {
    mappedFrames,
    totalBundleFrames: [...framesByBundle.values()].reduce((sum, bundleFrames) => sum + bundleFrames.length, 0),
    mappedBundles
  };
}
