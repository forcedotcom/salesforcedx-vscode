/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Effect } from 'effect';
import { Buffer } from 'node:buffer';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
import { SettingsService, SettingsServiceLive } from '../vscode/settingsService';
import { fsPrefix } from './constants';
import { fsProvider } from './fsTypes';
import { TEMPLATES, metadataDirs } from './templates/templates';

const sampleProjectPath = `${fsPrefix}:/${sampleProjectName}`;
console.log('projectInit reading homedir');
console.log(os);
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

const createConfigFiles = (memfs: fsProvider): void => {
  Object.entries(TEMPLATES).forEach(([name, content]) => {
    const uri = vscode.Uri.parse(`${sampleProjectPath}/${name}`);
    memfs.writeFile(uri, Buffer.from(content.join('\n')), {
      create: true,
      overwrite: true
    });
  });
};

const createProjectStructure = async (memfs: fsProvider): Promise<void> => {
  getDirsToCreate()
    .map(dir => vscode.Uri.parse(dir))
    .map(uri => memfs.createDirectory(uri));
  createConfigFiles(memfs);
  createVSCodeFiles(memfs);
};

const createVSCodeFiles = (memfs: fsProvider): void => {
  // Create .vscode directory and config files
  memfs.writeFile(
    vscode.Uri.parse(`${sampleProjectPath}/.vscode/tasks.json`),
    Buffer.from(JSON.stringify({ version: '2.0.0', tasks: [] }, null, 2)),
    { create: true, overwrite: true }
  );
  memfs.writeFile(
    vscode.Uri.parse(`${sampleProjectPath}/.vscode/launch.json`),
    Buffer.from(JSON.stringify({ version: '0.2.0', configurations: [] }, null, 2)),
    { create: true, overwrite: true }
  );
  memfs.writeFile(vscode.Uri.parse(`${sampleProjectPath}/.vscode/mcp.json`), Buffer.from(JSON.stringify({}, null, 2)), {
    create: true,
    overwrite: true
  });
};

/** create the files for an empty sfdx project */
export const projectFiles = async (memfs: fsProvider): Promise<void> => {
  if (!memfs.exists(vscode.Uri.parse(`${sampleProjectPath}/sfdx-project.json`))) {
    await createProjectStructure(memfs);
  } else {
  }
  const config = vscode.workspace.getConfiguration();
  await config.update('workbench.colorTheme', 'Monokai', vscode.ConfigurationTarget.Global);

  // Run the Effect with the SettingsService layer
  await Effect.runPromise(Effect.provide(setupCredentials, SettingsServiceLive));
};

// Create Effect for setting up test credentials
// TODO: delete this, or make it a separate extension that we don't ship, etc.  Some way to populate the test environment.
const setupCredentials = Effect.gen(function* () {
  const settingsService = yield* SettingsService;

  console.log('Setting up test credentials for web environment');
  const instanceUrl = 'https://efficiency-data-8147-dev-ed.scratch.my.salesforce.com';
  const accessToken =
    '00DD30000001cA5!ARsAQP.zHlUOmJbpXzELX6Tzl.zLgwBBtxe76xB1m2OtFzAyjyOptZOs4KB_FWakomEDRL253ALtZlAPo1FYeMpjdufqceAE';

  yield* settingsService.setInstanceUrl(instanceUrl);
  yield* settingsService.setAccessToken(accessToken);

  return { instanceUrl, accessToken };
});
