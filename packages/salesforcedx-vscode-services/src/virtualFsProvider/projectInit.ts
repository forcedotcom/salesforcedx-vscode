/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo } from '@salesforce/core';
import { Buffer } from 'node:buffer';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { sampleProjectName } from '../constants';
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
  // always need to be recreated since we don't have fs watchers outside the vscode workspace.
  await auth(memfs);
};

// TODO: auth a in a legit way
const auth = async (memfs: fsProvider): Promise<void> => {
  const authUrl =
    'force://PlatformCLI::5Aep861K4Pn8q4vWqPOgyp58bt0al7ZV8zn2amWmhbDOGNNLbalCDFv52t7BPfkBV1mqs3DKgRtrqIGDPbk.ZUu@efficiency-data-8147-dev-ed.scratch.my.salesforce.com ';
  const oauth2Options = AuthInfo.parseSfdxAuthUrl(authUrl);

  const authInfo = await AuthInfo.create({ oauth2Options });

  // eslint-disable-next-line functional/no-try-statements
  try {
    await authInfo.save();
    console.log('authInfo saved');
  } catch (e) {
    console.log('error saving authInfo', e);
  }

  await memfs.writeFile(
    vscode.Uri.parse(`${sampleProjectPath}/.sf/config.json`),
    Buffer.from(JSON.stringify({ 'target-org': authInfo.getUsername() }, null, 2)),
    {
      create: true,
      overwrite: true
    }
  );
};
