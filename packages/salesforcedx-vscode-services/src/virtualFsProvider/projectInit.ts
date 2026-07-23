/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { Buffer } from 'node:buffer';
import * as os from 'node:os';
import { URI } from 'vscode-uri';
import { unknownToErrorCause } from '../core/shared';
import { FsProvider } from './fsTypes';
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

const createConfigFiles = (fsp: FsProvider, sampleProjectPath: string): void => {
  Object.entries(TEMPLATES).forEach(([name, content]) => {
    const uri = URI.parse(`${sampleProjectPath}/${name}`);
    fsp.writeFile(uri, new Uint8Array(Buffer.from(content.join('\n'))), {
      create: true,
      overwrite: true
    });
  });
};

/** Creates the project directory structure and files */
const createProjectStructure = Effect.fn('projectInit: createProjectStructure')(function* (
  fsp: FsProvider,
  sampleProjectPath: string
) {
  yield* Effect.annotateCurrentSpan({ sampleProjectPath });
  const dirsToCreate = getDirsToCreate(sampleProjectPath);
  yield* Effect.annotateCurrentSpan({ dirsToCreate });

  yield* Effect.tryPromise({
    try: () =>
      Promise.all(
        dirsToCreate
          .map(dir => URI.parse(dir))
          .filter(uri => !fsp.exists(uri))
          .map(uri => fsp.createDirectory(uri))
      ),
    catch: (error: unknown) => new VirtualFsProviderError(unknownToErrorCause(error))
  });

  yield* Effect.all(
    [
      Effect.sync(() => createConfigFiles(fsp, sampleProjectPath)),
      Effect.sync(() => createVSCodeFiles(fsp, sampleProjectPath))
    ],
    {
      concurrency: 'unbounded'
    }
  );
});

const createVSCodeFiles = (fsp: FsProvider, sampleProjectPath: string): void => {
  // Create .vscode directory and config files
  fsp.writeFile(
    URI.parse(`${sampleProjectPath}/.vscode/tasks.json`),
    new Uint8Array(Buffer.from(JSON.stringify({ version: '2.0.0', tasks: [] }, null, 2))),
    { create: true, overwrite: true }
  );
  fsp.writeFile(
    URI.parse(`${sampleProjectPath}/.vscode/launch.json`),
    new Uint8Array(Buffer.from(JSON.stringify({ version: '0.2.0', configurations: [] }, null, 2))),
    { create: true, overwrite: true }
  );
  fsp.writeFile(
    URI.parse(`${sampleProjectPath}/.vscode/mcp.json`),
    new Uint8Array(Buffer.from(JSON.stringify({}, null, 2))),
    {
      create: true,
      overwrite: true
    }
  );
};

/** Creates the files for an empty sfdx project */
export const projectFiles = Effect.fn('projectFiles')(function* (fsp: FsProvider) {
  const sampleProjectPath = getProjectRoot().uri;
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
