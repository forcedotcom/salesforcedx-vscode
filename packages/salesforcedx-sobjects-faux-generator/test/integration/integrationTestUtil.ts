/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import childProcess = require('child_process');
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

// Used only for CI purposes. Must call delete if you call create
export function createCIKey(keyLocation: string) {
  const SERVER_KEY = process.env.SFDX_CI_DEVHUB_JWTKEY;
  console.log('key: ' + SERVER_KEY);
  if (SERVER_KEY) {
    fs.writeFileSync(keyLocation, SERVER_KEY);
  }
}

export function deleteCIKey(keyLocation: string) {
  if (fs.existsSync(keyLocation)) {
    fs.unlinkSync(keyLocation);
  }
}

export async function createSFDXProject(projectName: string): Promise<void> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:project:create')
      .withFlag('--projectname', projectName)
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  await cmdOutput.getCmdResult(execution);
  return Promise.resolve();
}

export async function createScratchOrg(projectName: string): Promise<string> {
  const scratchDefFilePath = path.join(
    process.cwd(),
    projectName,
    'config',
    'project-scratch-def.json'
  );
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:org:create')
      .withFlag('--definitionfile', scratchDefFilePath)
      .withJson()
      .build(),
    { cwd: path.join(process.cwd(), projectName) }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  const username = JSON.parse(result).result.username;
  return Promise.resolve(username);
}

export async function push(
  sourceFolder: string,
  projectName: string,
  username: string
): Promise<string> {
  const targetFolder = path.join(
    process.cwd(),
    projectName,
    'force-app',
    'main',
    'default'
  );
  childProcess.execSync('cp -R ' + sourceFolder + ' ' + targetFolder);
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:source:push')
      .withFlag('--targetusername', username)
      .withJson()
      .build(),
    { cwd: path.join(process.cwd(), projectName) }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  const source = JSON.parse(result).result.pushedSource;
  return Promise.resolve(source);
}

export async function createPermissionSet(
  permissionSetName: string,
  username: string
): Promise<string> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:data:record:create')
      .withFlag('--sobjecttype', 'PermissionSet')
      .withFlag('--targetusername', username)
      .withFlag(
        '--values',
        'Name=' + permissionSetName + " Label='Give FLS Read'"
      )
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  const permissionSetId = JSON.parse(result).result.id as string;
  return Promise.resolve(permissionSetId);
}

export async function createFieldPermissions(
  permissionSetId: string,
  sobjectType: string,
  fieldName: string,
  username: string
): Promise<void> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:data:record:create')
      .withFlag('--sobjecttype', 'FieldPermissions')
      .withFlag('--targetusername', username)
      .withFlag(
        '--values',
        util.format(
          'ParentId=%s SobjectType=%s Field=%s PermissionsRead=true',
          permissionSetId,
          sobjectType,
          fieldName
        )
      )
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  await cmdOutput.getCmdResult(execution);
  return Promise.resolve();
}

export async function assignPermissionSet(
  permissionSetName: string,
  username: string
): Promise<void> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:user:permset:assign')
      .withFlag('--permsetname', permissionSetName)
      .withFlag('--targetusername', username)
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  await cmdOutput.getCmdResult(execution);
  return Promise.resolve();
}
