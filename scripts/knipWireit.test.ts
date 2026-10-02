/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { glob } from 'glob';
// Repository configuration tests run in Node, not the VS Code extension host.
// eslint-disable-next-line no-restricted-imports
import fs from 'node:fs/promises';
import path from 'node:path';

type Manifest = {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  wireit: Record<string, { command?: string; dependencies?: string[]; files?: string[]; output?: string[] }>;
};

const root = path.resolve(__dirname, '..');
const readManifest = async (file: string): Promise<Manifest> => {
  // Repository-owned package manifests have a known shape; this test checks their Wireit fields.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const manifest: Manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  return manifest;
};

test('workspace Knip tasks track exactly the workspaces Knip selects', async () => {
  const rootManifest = await readManifest(path.join(root, 'package.json'));
  const workspaces = (await glob('packages/*/package.json', { cwd: root }))
    .map(file => path.basename(path.dirname(file)))
    .toSorted();
  const workspaceManifests = await Promise.all(
    workspaces.map(async directory => ({
      directory,
      manifest: await readManifest(path.join(root, 'packages', directory, 'package.json'))
    }))
  );
  const manifests = new Map(workspaceManifests.map(({ directory, manifest }) => [directory, manifest]));
  const directoriesByName = new Map([...manifests].map(([directory, manifest]) => [manifest.name, directory]));
  const workspaceDependencies = (manifest: Manifest): string[] =>
    Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies
    })
      .map(name => directoriesByName.get(name))
      .filter((directory): directory is string => directory !== undefined);
  const graph = new Map([...manifests].map(([directory, manifest]) => [directory, workspaceDependencies(manifest)]));

  expect(rootManifest.wireit['check:knip']).toEqual({
    dependencies: workspaces.map(directory => `./packages/${directory}:check:knip`)
  });
  expect(rootManifest.wireit.precommit.dependencies).toContain('check:knip');

  const extensions = '{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,yaml,yml}';
  const rootFiles = [
    `../../*.${extensions}`,
    '../../.gitignore',
    '../../.pnpmfile.cjs',
    `../../{scripts,test,test-workspaces,config,.github,.opencode}/**/*.${extensions}`
  ];

  for (const [directory, manifest] of manifests) {
    const selected = new Set([directory]);
    const pending = [...selected];
    while (pending.length > 0) {
      for (const dependency of graph.get(pending.pop()!) ?? []) {
        if (!selected.has(dependency)) {
          selected.add(dependency);
          pending.push(dependency);
        }
      }
    }
    for (const [other, dependencies] of graph) {
      if (dependencies.includes(directory)) selected.add(other);
    }

    const packageFiles = [...selected].toSorted().flatMap(other => {
      const prefix = other === directory ? '' : `../${other}/`;
      return [
        `${prefix}*.${extensions}`,
        `${prefix}{src,test,typings,scripts,bin,jest,__mocks__,resources}/**/*.${extensions}`,
        `${prefix}.gitignore`
      ];
    });

    expect(manifest.scripts?.['check:knip']).toBe('wireit');
    expect(manifest.wireit['check:knip']).toEqual({
      command: `../../node_modules/.bin/knip --directory ../.. --workspace packages/${directory} --cache --cache-location ../../node_modules/.cache/knip-${directory} --include exports,types,nsExports,nsTypes --no-config-hints`,
      files: [...rootFiles, ...packageFiles],
      output: []
    });
  }
});
