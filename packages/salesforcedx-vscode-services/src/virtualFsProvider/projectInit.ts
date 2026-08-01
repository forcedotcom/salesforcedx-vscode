/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { not } from 'effect/Predicate';
import { Buffer } from 'node:buffer';
import * as os from 'node:os';
import { URI, Utils } from 'vscode-uri';
import { unknownToErrorCause } from '../core/shared';
import { FsProvider } from './fsTypes';
import { getProjectRoot } from './projectRoot';
import { TEMPLATES, metadataDirs } from './templates/templates';
import { VirtualFsProviderError } from './virtualFsProviderError';

const home = os.homedir();

const getDirsToCreate = (sampleProjectUri: URI): URI[] => [
  URI.file(`${home}/.sfdx`),
  URI.file(`${home}/.sf`),
  Utils.joinPath(sampleProjectUri, '.vscode'),
  Utils.joinPath(sampleProjectUri, '.sf'),
  Utils.joinPath(sampleProjectUri, '.sfdx'),
  Utils.joinPath(sampleProjectUri, 'force-app'),
  Utils.joinPath(sampleProjectUri, 'force-app', 'main'),
  Utils.joinPath(sampleProjectUri, 'force-app', 'main', 'default'),
  ...metadataDirs.map(dir => Utils.joinPath(sampleProjectUri, 'force-app', 'main', 'default', dir))
];

const createConfigFiles = (fsp: FsProvider, sampleProjectUri: URI): void => {
  Object.entries(TEMPLATES).forEach(([name, content]) => {
    const uri = Utils.joinPath(sampleProjectUri, name);
    fsp.writeFile(uri, new Uint8Array(Buffer.from(content.join('\n'))), {
      create: true,
      overwrite: true
    });
  });
};

/** Creates the project directory structure and files */
const createProjectStructure = Effect.fn('projectInit: createProjectStructure')(function* (
  fsp: FsProvider,
  sampleProjectUri: URI
) {
  yield* Effect.annotateCurrentSpan({ sampleProjectPath: sampleProjectUri.toString() });
  const dirsToCreate = getDirsToCreate(sampleProjectUri);
  yield* Effect.annotateCurrentSpan({ dirsToCreate: dirsToCreate.map(uri => uri.toString()) });

  yield* Effect.tryPromise({
    try: () =>
      Promise.all(
        dirsToCreate.filter(not(fsp.exists)).map(uri => fsp.createDirectory(uri))
      ),
    catch: (error: unknown) => new VirtualFsProviderError(unknownToErrorCause(error))
  });

  yield* Effect.all(
    [
      Effect.sync(() => createConfigFiles(fsp, sampleProjectUri)),
      Effect.sync(() => createVSCodeFiles(fsp, sampleProjectUri))
    ],
    {
      concurrency: 'unbounded'
    }
  );
});

const createVSCodeFiles = (fsp: FsProvider, sampleProjectUri: URI): void => {
  // Create .vscode directory and config files
  fsp.writeFile(
    Utils.joinPath(sampleProjectUri, '.vscode', 'tasks.json'),
    new Uint8Array(Buffer.from(JSON.stringify({ version: '2.0.0', tasks: [] }, null, 2))),
    { create: true, overwrite: true }
  );
  fsp.writeFile(
    Utils.joinPath(sampleProjectUri, '.vscode', 'launch.json'),
    new Uint8Array(Buffer.from(JSON.stringify({ version: '0.2.0', configurations: [] }, null, 2))),
    { create: true, overwrite: true }
  );
  fsp.writeFile(
    Utils.joinPath(sampleProjectUri, '.vscode', 'mcp.json'),
    new Uint8Array(Buffer.from(JSON.stringify({}, null, 2))),
    {
      create: true,
      overwrite: true
    }
  );
};

/** Creates the files for an empty sfdx project */
export const projectFiles = Effect.fn('projectFiles')(function* (fsp: FsProvider) {
  const sampleProjectUri = (yield* getProjectRoot()).uri;
  // Check if project already exists, if not create it
  const projectExists = fsp.exists(Utils.joinPath(sampleProjectUri, 'sfdx-project.json'));
  yield* Effect.annotateCurrentSpan({
    projectExists,
    projectFiles: fsp.readDirectory(sampleProjectUri)
  });

  if (!projectExists) {
    yield* createProjectStructure(fsp, sampleProjectUri);
  }
});
