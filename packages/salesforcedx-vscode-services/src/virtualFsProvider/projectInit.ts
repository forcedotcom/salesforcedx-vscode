/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import { Buffer } from 'node:buffer';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
import { SdkLayer } from '../observability/spans';
import { SettingsService } from '../vscode/settingsService';
import { fsPrefix } from './constants';
import { fsProvider } from './fsTypes';
import { TEMPLATES, metadataDirs } from './templates/templates';

const sampleProjectPath = `${fsPrefix}:/${sampleProjectName}`;
const home = os.homedir();

const getDirsToCreate = (): string[] => [
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

const createConfigFiles = (fsp: fsProvider): void => {
  Object.entries(TEMPLATES).forEach(([name, content]) => {
    const uri = vscode.Uri.parse(`${sampleProjectPath}/${name}`);
    fsp.writeFile(uri, new Uint8Array(Buffer.from(content.join('\n'))), {
      create: true,
      overwrite: true
    });
  });
};

/** Creates the project directory structure and files */
const createProjectStructure = (fsp: fsProvider): Effect.Effect<void, Error, never> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ sampleProjectPath });
    const dirsToCreate = getDirsToCreate();
    yield* Effect.annotateCurrentSpan({ dirsToCreate });
    // Create all directories
    yield* Effect.tryPromise({
      try: () =>
        Promise.all(
          dirsToCreate
            .map(dir => vscode.Uri.parse(dir))
            .map(uri => {
              console.log('uri', uri);
              return uri;
            })
            .filter(uri => !fsp.exists(uri))
            .map(uri => {
              console.log('nonexistent uri', uri);
              return uri;
            })
            .map(uri => fsp.createDirectory(uri))
        ),
      catch: (error: unknown) => new Error(`Failed to create project directories: ${String(error)}`)
    });

    yield* Effect.all([Effect.sync(() => createConfigFiles(fsp)), Effect.sync(() => createVSCodeFiles(fsp))], {
      concurrency: 'unbounded'
    });
  }).pipe(Effect.withSpan('projectInit: createProjectStructure'));

const createVSCodeFiles = (fsp: fsProvider): void => {
  // Create .vscode directory and config files
  fsp.writeFile(
    vscode.Uri.parse(`${sampleProjectPath}/.vscode/tasks.json`),
    new Uint8Array(Buffer.from(JSON.stringify({ version: '2.0.0', tasks: [] }, null, 2))),
    { create: true, overwrite: true }
  );
  fsp.writeFile(
    vscode.Uri.parse(`${sampleProjectPath}/.vscode/launch.json`),
    new Uint8Array(Buffer.from(JSON.stringify({ version: '0.2.0', configurations: [] }, null, 2))),
    { create: true, overwrite: true }
  );
  fsp.writeFile(
    vscode.Uri.parse(`${sampleProjectPath}/.vscode/mcp.json`),
    new Uint8Array(Buffer.from(JSON.stringify({}, null, 2))),
    {
      create: true,
      overwrite: true
    }
  );
};

/** Creates the files for an empty sfdx project */
export const projectFiles = (fsp: fsProvider): Effect.Effect<void, Error, SettingsService> =>
  Effect.gen(function* () {
    // Check if project already exists, if not create it
    const projectExists = fsp.exists(vscode.Uri.parse(`${sampleProjectPath}/sfdx-project.json`));
    yield* Effect.annotateCurrentSpan({
      projectExists,
      projectFiles: fsp.readDirectory(vscode.Uri.parse(`${sampleProjectPath}`))
    });

    if (!projectExists) {
      yield* createProjectStructure(fsp);
    }
  })
    .pipe(Effect.withSpan('projectFiles'))
    .pipe(Effect.provide(SdkLayer));
