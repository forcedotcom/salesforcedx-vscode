/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import { cp } from 'shelljs';
import * as util from 'util';
import { Uri } from 'vscode';

// Used only for CI purposes. Must call delete if you call create
export const generateSFProject = async (projectName: string): Promise<void> => {
  const execution = new CliCommandExecutor(
    new SfCommandBuilder().withArg('project:generate').withFlag('--name', projectName).withJson().build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  await cmdOutput.getCmdResult(execution);
  return Promise.resolve();
};

export const createScratchOrg = async (projectName: string): Promise<string> => {
  const scratchDefFilePath = path.join(process.cwd(), projectName, 'config', 'project-scratch-def.json');
  const execution = new CliCommandExecutor(
    new SfCommandBuilder()
      .withArg('org:create:scratch')
      .withFlag('--definition-file', `${scratchDefFilePath}`)
      .withArg('--set-default')
      .withJson()
      .build(),
    { cwd: path.join(process.cwd(), projectName) }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  const username = JSON.parse(result).result.username;
  return Promise.resolve(username);
};

export const deleteScratchOrg = async (projectName: string, username: string): Promise<string> => {
  const execution = new CliCommandExecutor(
    new SfCommandBuilder()
      .withArg('org:delete:scratch')
      .withFlag('--target-org', username)
      .withArg('--no-prompt')
      .withJson()
      .build(),
    { cwd: path.join(process.cwd(), projectName) }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  return Promise.resolve(result);
};

export const pushSource = async (sourceFolder: string, projectName: string, username: string): Promise<string> => {
  const targetFolder = path.join(process.cwd(), projectName, 'force-app', 'main', 'default');
  cp('-R', sourceFolder, targetFolder);
  const execution = new CliCommandExecutor(
    new SfCommandBuilder().withArg('project:deploy:start').withFlag('--target-org', username).withJson().build(),
    { cwd: path.join(process.cwd(), projectName) }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  const source = JSON.parse(result).files;
  return Promise.resolve(source);
};

export const pullSource = async (projectName: string, username: string): Promise<string> => {
  const execution = new CliCommandExecutor(
    new SfCommandBuilder().withArg('project:retrieve:start').withFlag('--target-org', username).withJson().build(),
    { cwd: path.join(process.cwd(), projectName) }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  const source = JSON.parse(result).result.files;
  return Promise.resolve(source);
};

export const createPermissionSet = async (permissionSetName: string, username: string): Promise<string> => {
  const execution = new CliCommandExecutor(
    new SfCommandBuilder()
      .withArg('data:create:record')
      .withFlag('--sobject', 'PermissionSet')
      .withFlag('--target-org', username)
      .withFlag('--values', 'Name=' + permissionSetName + ' Label="Give FLS Read"')
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  const permissionSetId = JSON.parse(result).result.id as string;
  return Promise.resolve(permissionSetId);
};

export const createFieldPermissions = async (
  permissionSetId: string,
  sobjectType: string,
  fieldName: string,
  username: string
): Promise<void> => {
  const execution = new CliCommandExecutor(
    new SfCommandBuilder()
      .withArg('data:create:record')
      .withFlag('--sobject', 'FieldPermissions')
      .withFlag('--target-org', username)
      .withFlag(
        '--values',
        util.format('ParentId=%s SobjectType=%s Field=%s PermissionsRead=true', permissionSetId, sobjectType, fieldName)
      )
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  await cmdOutput.getCmdResult(execution);
  return Promise.resolve();
};

export const assignPermissionSet = async (permissionSetName: string, username: string): Promise<void> => {
  const execution = new CliCommandExecutor(
    new SfCommandBuilder()
      .withArg('org:assign:permset')
      .withFlag('--name', permissionSetName)
      .withFlag('--target-org', username)
      .withJson()
      .build(),
    { cwd: process.cwd() }
  ).execute();
  const cmdOutput = new CommandOutput();
  await cmdOutput.getCmdResult(execution);
  return Promise.resolve();
};

export const addFeatureToScratchOrgConfig = (projectName: string, feature: string): void => {
  const scratchDefFilePath = path.join(process.cwd(), projectName, 'config', 'project-scratch-def.json');
  const config = JSON.parse(fs.readFileSync(scratchDefFilePath).toString());
  if (config) {
    let featuresList = config.features || '';
    featuresList += feature;
    config.features = featuresList;
  }
  fs.writeFileSync(scratchDefFilePath, JSON.stringify(config, null, '\t'), {
    encoding: 'utf8'
  });
};

export const pathToUri = (str: string): string => {
  const uri = Uri.file(str.replace(/\\/g, '/'));
  return uri.toString();
};
