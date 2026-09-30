/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Array as Arr, HashSet } from 'effect';

export const servicesDir = 'salesforcedx-vscode-services';
export const servicesIndex = `packages/${servicesDir}/src/index.ts`;
const servicesLayersPath = `packages/${servicesDir}/src/servicesLayers.ts`;

export type ServiceChange =
  | { readonly kind: 'shared' }
  | { readonly kind: 'services'; readonly names: readonly string[] }
  | { readonly kind: 'none' };
export type SrcFile = { readonly path: string; readonly text: string };

const uniqueSorted = (values: readonly string[]) => Arr.fromIterable(HashSet.fromIterable(values)).toSorted();

const dirnamePosix = (file: string) => file.split('/').slice(0, -1).join('/');

const normalizePosix = (parts: readonly string[]) =>
  parts.reduce<readonly string[]>(
    (stack, part) => (part === '' || part === '.' ? stack : part === '..' ? stack.slice(0, -1) : [...stack, part]),
    []
  );

const importCandidates = (from: string, spec: string) => {
  const base = normalizePosix([...dirnamePosix(from).split('/'), ...spec.split('/')]).join('/');
  return /\.(ts|tsx|mts)$/.test(spec) ? [base] : [`${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}/index.ts`];
};

const servicesObject = (source: string) => {
  const at = source.lastIndexOf('services: {');
  if (at < 0) return '';
  const block = source.slice(at);
  const end = block.search(/\n {6}\}/);
  return end < 0 ? block : block.slice(0, end);
};

const apiProperties = (source: string) =>
  [
    ...servicesObject(source).matchAll(
      /^\s+([A-Za-z0-9_]+)(?:\s*:\s*(?:typeof\s+)?([A-Za-z0-9_]+))?\s*,?\s*(?:\/\/.*)?$/gm
    )
  ].flatMap(match => {
    const key = match[1];
    return key === undefined ? [] : [{ key, local: match[2] ?? key }];
  });

const localImportSpecs = (source: string) =>
  Object.fromEntries(
    [...source.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g)].flatMap(match => {
      const inner = match[1];
      const spec = match[2];
      if (inner === undefined || spec === undefined) return [];
      return inner.split(',').flatMap(part => {
        const parsed = /^(?:type\s+)?([A-Za-z0-9_]+)(?:\s+as\s+([A-Za-z0-9_]+))?$/.exec(part.trim());
        const imported = parsed?.[1];
        return imported === undefined ? [] : [[parsed?.[2] ?? imported, spec] as const];
      });
    })
  );

const keysByFile = (indexSource: string) => {
  const specs = localImportSpecs(indexSource);
  return apiProperties(indexSource).reduce<Readonly<Record<string, readonly string[]>>>((acc, property) => {
    const spec = specs[property.local];
    return spec === undefined
      ? acc
      : importCandidates(servicesIndex, spec).reduce(
          (keys, candidate) => ({ ...keys, [candidate]: [...(keys[candidate] ?? []), property.key] }),
          acc
        );
  }, {});
};

const importersOf = (srcFiles: readonly SrcFile[]) =>
  srcFiles.reduce<Readonly<Record<string, readonly string[]>>>((acc, file) => {
    const specs = [...file.text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].flatMap(match =>
      match[1] === undefined ? [] : [match[1]]
    );
    return specs
      .flatMap(spec => importCandidates(file.path, spec))
      .reduce((map, candidate) => ({ ...map, [candidate]: [...(map[candidate] ?? []), file.path] }), acc);
  }, {});

const namesForFile = (
  file: string,
  keys: Readonly<Record<string, readonly string[]>>,
  importers: Readonly<Record<string, readonly string[]>>,
  seen: ReadonlySet<string>
): readonly string[] => {
  if (seen.has(file)) return [];
  const direct = keys[file] ?? [];
  if (direct.length > 0) return direct;
  const next = new Set(seen).add(file);
  return uniqueSorted((importers[file] ?? []).flatMap(importer => namesForFile(importer, keys, importers, next)));
};

const changedBody = (line: string) =>
  (line.startsWith('+') && !line.startsWith('+++')) || (line.startsWith('-') && !line.startsWith('---'))
    ? line.slice(1)
    : undefined;

const sharedWiring =
  /prebuiltServicesLayer|buildAllServicesLayer|\bglobalLayers\b|\binternalLayers\b|const requirements|const builtContext|buildWithScope\(requirements|provideMerge\(globalLayers\)/;

const diffTouchesSharedLayer = (section: string) =>
  section.split(/^@@/m).some(hunk => {
    const lines = hunk.split('\n');
    const edited = lines.some(line => {
      const body = changedBody(line);
      return body !== undefined && body.trim().length > 0;
    });
    return edited && lines.some(line => sharedWiring.test(line.replace(/^[+\- ]/, '')));
  });

const diffEditsSharedLayerFile = (section: string) =>
  section.split('\n').some(line => {
    const trimmed = changedBody(line)?.trim();
    return (
      trimmed !== undefined &&
      trimmed.length > 0 &&
      !trimmed.startsWith('//') &&
      !trimmed.startsWith('*') &&
      !trimmed.startsWith('/*')
    );
  });

const fileSection = (diff: string, file: string) =>
  diff.split(/^diff --git /m).find(part => part.startsWith(`a/${file} `)) ?? '';

const keysOnChangedLines = (diff: string, keys: readonly string[]) =>
  uniqueSorted(
    diff.split('\n').flatMap(line => {
      if ((!line.startsWith('+') && !line.startsWith('-')) || line.startsWith('+++') || line.startsWith('---'))
        return [];
      const name = /^\s*([A-Za-z0-9_]+)\s*(?:,|:)/.exec(line.slice(1))?.[1];
      return name !== undefined && keys.includes(name) ? [name] : [];
    })
  );

export const serviceChange = (
  indexSource: string,
  srcFiles: readonly SrcFile[],
  changed: readonly string[],
  servicesDiff: string
): ServiceChange => {
  const indexDiff = fileSection(servicesDiff, servicesIndex);
  const layersDiff = fileSection(servicesDiff, servicesLayersPath);
  if (
    (changed.includes(servicesIndex) && diffTouchesSharedLayer(indexDiff)) ||
    (changed.includes(servicesLayersPath) && diffEditsSharedLayerFile(layersDiff))
  )
    return { kind: 'shared' };
  const keys = keysByFile(indexSource);
  const importers = importersOf(srcFiles);
  const fromFiles = changed
    .filter(file => file.startsWith(`packages/${servicesDir}/src/`) && file !== servicesIndex)
    .flatMap(file => namesForFile(file, keys, importers, new Set()));
  const fromIndex = changed.includes(servicesIndex)
    ? keysOnChangedLines(
        indexDiff,
        apiProperties(indexSource).map(property => property.key)
      )
    : [];
  const names = uniqueSorted([...fromFiles, ...fromIndex]);
  return names.length === 0 ? { kind: 'none' } : { kind: 'services', names };
};
