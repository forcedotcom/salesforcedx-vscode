/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Global } from '@salesforce/core';
import { Effect } from 'effect';
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
  if (Global.isWeb) {
    // always need to be recreated on web since we don't have fs watchers outside the vscode workspace.
    console.log('🔍 Starting auth Effect for web...');
    await Effect.runPromise(
      auth(memfs).pipe(
        Effect.tap(() => Effect.sync(() => console.log('✅ Auth Effect completed successfully'))),
        Effect.tapError(error => Effect.sync(() => console.error('❌ Auth Effect failed:', error)))
      )
    );
  }
};

// Helper function for web authentication attempt
const attemptWebAuth = async (memfs: fsProvider): Promise<boolean> => {
  const createAuth = async (): Promise<AuthInfo | undefined> => {
    console.log('Attempting AuthInfo.create in web environment...');
    // TODO: define in web env
    const accessTokenOptions = {
      accessToken:
        '00DD30000001cA5!ARsAQAWsC0ok8cEtfE18lQmwfnWWdJ5t.rUUa4UcNpOtFYZBVB2pNJ41CsuJAHDh2vyW6ypT9mbAHqot8Eb35bTZIuHvbEH7',
      loginUrl: 'https://efficiency-data-8147-dev-ed.scratch.my.salesforce.com'
    };
    const username = 'test-ybpyiui8xxjf@example.com';
    return AuthInfo.create({ accessTokenOptions, username }).catch(error => {
      console.log('AuthInfo.create failed in web environment:', error);
      console.log('options:', accessTokenOptions);
      console.error(`AuthInfo.create error details: ${error.name} ${error.message} ${error.stack}`);

      return undefined;
    });
  };

  const saveAuth = async (webAuth: AuthInfo): Promise<AuthInfo | undefined> => {
    console.log('AuthInfo.create succeeded, attempting save...');
    return webAuth
      .save()
      .then(() => {
        console.log('authInfo.save() succeeded in web environment');
        return webAuth;
      })
      .catch(error => {
        console.log('authInfo.save() failed in web environment:', error);
        return undefined;
      });
  };

  const writeConfig = async (finalAuth: AuthInfo): Promise<void> => {
    await memfs.writeFile(
      vscode.Uri.parse(`${sampleProjectPath}/.sf/config.json`),
      Buffer.from(JSON.stringify({ 'target-org': finalAuth.getUsername() }, null, 2)),
      { create: true, overwrite: true }
    );
    console.log('Real auth flow completed successfully in web environment');
  };

  const createdAuth = await createAuth();
  if (!createdAuth) return false;

  const savedAuth = await saveAuth(createdAuth);
  if (!savedAuth) return false;

  await writeConfig(savedAuth);
  return true;
};

// TODO: auth a in a legit way
const auth = (memfs: fsProvider): Effect.Effect<void, Error> => {
  // Use sfdx-core's Global.isWeb to detect web environment
  if (Global.isWeb) {
    console.log('Web environment detected - real auth MUST succeed');
    return Effect.tryPromise({
      try: () => attemptWebAuth(memfs),
      catch: error => {
        console.error('❌ Web auth attempt failed:', error);
        return new Error(`Web authentication failed - no fallback allowed: ${error}`);
      }
    }).pipe(
      Effect.flatMap(authSuccess => {
        console.log('🔍 Web auth result:', authSuccess);
        return authSuccess
          ? Effect.succeed(console.log('✅ Web auth succeeded'))
          : Effect.fail(new Error('Web authentication returned false - no fallback allowed'));
      })
    );
  }

  return Effect.fail(new Error('Desktop authentication not supported in web environment'));
};
