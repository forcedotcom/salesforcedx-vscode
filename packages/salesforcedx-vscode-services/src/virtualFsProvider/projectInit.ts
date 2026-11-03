/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { not } from 'effect/Predicate';
import { toEntries } from 'effect/Record';
import { Buffer } from 'node:buffer';
import * as os from 'node:os';
import { URI } from 'vscode-uri';
import { unknownToErrorCause } from '../services/errorCause';
import { type FsProvider } from './fsTypes';
import { getProjectRoot } from './projectRoot';
import { TEMPLATES, metadataDirs } from './templates/templates';
import { VirtualFsProviderError } from './virtualFsProviderError';

const home = os.homedir();

const getDirsToCreate = (sampleProjectPath: string): string[] => [
  `${home}/.sfdx`,
  `${home}/.sf`,
  `${sampleProjectPath}/.vscode`,
  `${sampleProjectPath}/.sf`,
  `${sampleProjectPath}/.sfdx`,
  `${sampleProjectPath}/force-app`,
  `${sampleProjectPath}/force-app/main`,
  `${sampleProjectPath}/force-app/main/default`,
  ...metadataDirs.map(dir => `${sampleProjectPath}/force-app/main/default/${dir}`)
];

const writeProjectFile = Effect.fn('projectInit.writeFile')((fsp: FsProvider, uri: URI, content: string) =>
  Effect.tryPromise({
    try: async () => {
      await fsp.writeFile(uri, new Uint8Array(Buffer.from(content)), { create: true, overwrite: true });
    },
    catch: cause => new VirtualFsProviderError({ ...unknownToErrorCause(cause), path: uri.path })
  }).pipe(Effect.uninterruptible)
);
const createConfigFiles = (fsp: FsProvider, sampleProjectPath: string) =>
  Effect.forEach(
    toEntries(TEMPLATES),
    ([name, content]) => writeProjectFile(fsp, URI.parse(`${sampleProjectPath}/${name}`), content.join('\n')),
    { discard: true }
  );

/** Creates the project directory structure and files */
const createProjectStructure = Effect.fn('projectInit: createProjectStructure')(function* (
  fsp: FsProvider,
  sampleProjectPath: string
) {
  yield* Effect.annotateCurrentSpan({ sampleProjectPath });
  const dirsToCreate = getDirsToCreate(sampleProjectPath);
  yield* Effect.annotateCurrentSpan({ dirsToCreate });

  yield* Effect.forEach(
    dirsToCreate.map(dir => URI.parse(dir)).filter(not(fsp.exists)),
    uri =>
      Effect.tryPromise({
        try: async () => {
          await fsp.createDirectory(uri);
        },
        catch: cause => new VirtualFsProviderError({ ...unknownToErrorCause(cause), path: uri.path })
      }).pipe(Effect.uninterruptible),
    { concurrency: 'unbounded', discard: true }
  );

  yield* Effect.all([createConfigFiles(fsp, sampleProjectPath), createVSCodeFiles(fsp, sampleProjectPath)], {
    concurrency: 'unbounded'
  });
});

const createVSCodeFiles = (fsp: FsProvider, sampleProjectPath: string) =>
  Effect.forEach(
    [
      { name: 'tasks.json', content: { version: '2.0.0', tasks: [] } },
      { name: 'launch.json', content: { version: '0.2.0', configurations: [] } },
      { name: 'mcp.json', content: {} }
    ],
    ({ name, content }) =>
      writeProjectFile(fsp, URI.parse(`${sampleProjectPath}/.vscode/${name}`), JSON.stringify(content, null, 2)),
    { discard: true }
  );

/** Creates the files for an empty sfdx project */
export const projectFiles = Effect.fn('projectFiles')(function* (fsp: FsProvider) {
  const sampleProjectPath = (yield* getProjectRoot()).uri;
  // Check if project already exists, if not create it
  const projectExists = fsp.exists(URI.parse(`${sampleProjectPath}/sfdx-project.json`));
  yield* Effect.annotateCurrentSpan({
    projectExists,
    projectFiles: fsp.readDirectory(URI.parse(`${sampleProjectPath}`))
  });

  if (!projectExists) {
    yield* createProjectStructure(fsp, sampleProjectPath);
  }
});
