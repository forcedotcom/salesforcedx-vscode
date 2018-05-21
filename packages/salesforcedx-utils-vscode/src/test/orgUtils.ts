/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { cp } from 'shelljs';
import * as util from 'util';
import { CliCommandExecutor, CommandOutput, SfdxCommandBuilder } from '../cli';

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
      .withFlag('--definitionfile', `${scratchDefFilePath}`)
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

export async function deleteScratchOrg(
  projectName: string,
  username: string
): Promise<string> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:org:delete')
      .withFlag('--targetusername', username)
      .withArg('--noprompt')
      .withJson()
      .build(),
    { cwd: path.join(process.cwd(), projectName) }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  return Promise.resolve(result);
}

export async function pushSource(
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
  cp('-R', sourceFolder, targetFolder);
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

export async function pullSource(
  projectName: string,
  username: string
): Promise<string> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:source:pull')
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
        'Name=' + permissionSetName + ' Label="Give FLS Read"'
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

export function addFeatureToScratchOrgConfig(
  projectName: string,
  feature: string
): void {
  const scratchDefFilePath = path.join(
    process.cwd(),
    projectName,
    'config',
    'project-scratch-def.json'
  );
  const config = JSON.parse(fs.readFileSync(scratchDefFilePath).toString());
  if (config) {
    let featuresList = config.features || '';
    featuresList += feature;
    config.features = featuresList;
  }
  fs.writeFileSync(
    scratchDefFilePath,
    JSON.stringify(config, null, '\t'),
    'utf8'
  );
}

export function pathToUri(str: string): string {
  let pathName = str.replace(/\\/g, '/');
  if (pathName[0] !== '/') {
    pathName = '/' + pathName;
  }
  return encodeURI('file://' + pathName);
}
