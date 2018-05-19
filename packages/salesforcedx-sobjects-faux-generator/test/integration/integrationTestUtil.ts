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
import { CancellationToken } from '../../src/generator/fauxClassGenerator';
import childProcess = require('child_process');
import * as path from 'path';
import * as util from 'util';

// Used only for CI purposes. Must call delete if you call create
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
      .withArg('--setdefaultusername')
      .withJson()
      .build(),
    { cwd: path.join(process.cwd(), projectName) }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  const username = JSON.parse(result).result.username;
  return Promise.resolve(username);
}

export async function deleteScratchOrg(userName: string): Promise<void> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:org:delete')
      .withFlag('--targetusername', userName)
      .withArg('--noprompt')
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  await cmdOutput.getCmdResult(execution);
  return Promise.resolve();
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
        // tslint:disable-next-line:quotemark
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
  objectsWithCustomFields: CustomFieldInfo[],
  username: string
): Promise<void> {
  for (const objectInfo of objectsWithCustomFields) {
    for (const fieldName of objectInfo.customFieldNames) {
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
              objectInfo.sobjectName,
              fieldName
            )
          )
          .withJson()
          .build(),
        { cwd: process.cwd() }
      ).execute();
      const cmdOutput = new CommandOutput();
      await cmdOutput.getCmdResult(execution);
    }
  }
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

export class CustomFieldInfo {
  public sobjectName: string;
  public customFieldNames: string[];
  public constructor(sobjectName: string, customFieldNames: string[]) {
    this.sobjectName = sobjectName;
    this.customFieldNames = customFieldNames;
  }
}

export async function initializeProject(
  projectName: string,
  sourceFolder: string,
  customFields: CustomFieldInfo[]
): Promise<string> {
  const SIMPLE_OBJECT_DIR = path.join(
    'test',
    'integration',
    'config',
    sourceFolder,
    'objects'
  );

  let username: string;

  await createSFDXProject(projectName);
  username = await createScratchOrg(projectName);

  const sourceFolderPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    SIMPLE_OBJECT_DIR
  );
  await push(sourceFolderPath, projectName, username);

  const permSetName = 'AllowRead';
  const permissionSetId = await createPermissionSet(permSetName, username);

  await createFieldPermissions(permissionSetId, customFields, username);

  await assignPermissionSet(permSetName, username);

  return username;
}

// Added to be able to test cancellation of FauxClassGenerator.generate
// mimic of vscode but shouldn't depend on vscode in this package

class StandardCancellationToken implements CancellationToken {
  public isCancellationRequested = false;
}
export class CancellationTokenSource {
  public token: CancellationToken = new StandardCancellationToken();

  public cancel(): void {
    this.token.isCancellationRequested = true;
  }

  public dispose(): void {
    this.cancel();
  }
}
