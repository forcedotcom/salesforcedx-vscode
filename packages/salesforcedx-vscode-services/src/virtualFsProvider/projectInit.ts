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
const attemptWebAuth = async (webAuthUrl: string, memfs: fsProvider): Promise<boolean> => {
  const webOauth2Options = AuthInfo.parseSfdxAuthUrl(webAuthUrl);

  const createAuth = async (): Promise<AuthInfo | undefined> => {
    console.log('Attempting AuthInfo.create in web environment...');
    return AuthInfo.create({ oauth2Options: webOauth2Options }).catch(error => {
      console.log('AuthInfo.create failed in web environment:', error);
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

    const webAuthUrl =
      'force://PlatformCLI::5Aep861K4Pn8q4vWqPOgyp58bt0al7ZV8zn2amWmhbDOGNNLbalCDFv52t7BPfkBV1mqs3DKgRtrqIGDPbk.ZUu@efficiency-data-8147-dev-ed.scratch.my.salesforce.com ';

    return Effect.tryPromise({
      try: () => attemptWebAuth(webAuthUrl, memfs),
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

  // Desktop environment - use real authentication
  const authUrl =
    'force://PlatformCLI::5Aep861K4Pn8q4vWqPOgyp58bt0al7ZV8zn2amWmhbDOGNNLbalCDFv52t7BPfkBV1mqs3DKgRtrqIGDPbk.ZUu@efficiency-data-8147-dev-ed.scratch.my.salesforce.com ';
  const oauth2Options = AuthInfo.parseSfdxAuthUrl(authUrl);

  return Effect.tryPromise({
    try: async () => {
      console.log('🔍 Starting desktop auth...');
      const authInfo = await AuthInfo.create({ oauth2Options });
      console.log('✅ AuthInfo created for desktop.');

      await authInfo.save();
      console.log('✅ authInfo saved');

      await memfs.writeFile(
        vscode.Uri.parse(`${sampleProjectPath}/.sf/config.json`),
        Buffer.from(JSON.stringify({ 'target-org': authInfo.getUsername() }, null, 2)),
        {
          create: true,
          overwrite: true
        }
      );
      console.log('✅ Desktop auth completed successfully');
    },
    catch: error => {
      console.error('❌ Desktop authentication failed:', error);
      return new Error(`Desktop authentication failed: ${error}`);
    }
  });
};
