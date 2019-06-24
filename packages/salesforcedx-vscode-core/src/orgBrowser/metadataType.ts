/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir } from 'shelljs';
import { isNullOrUndefined } from 'util';
import { SfdxCommandletExecutor } from '../commands';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';

export class ForceDescribeMetadataExecutor extends SfdxCommandletExecutor<
  string
> {
  public constructor() {
    super();
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withArg('force:mdapi:describemetadata')
      .withJson()
      .withLogName('force_describe_metadata')
      .build();
  }
}

export async function forceDescribeMetadata(
  outputFolder: string
): Promise<string> {
  const execution = new CliCommandExecutor(
    new ForceDescribeMetadataExecutor().build({}),
    { cwd: getRootWorkspacePath() }
  ).execute();
  if (!fs.existsSync(outputFolder)) {
    mkdir('-p', outputFolder);
  }
  const filePath = path.join(outputFolder, 'metadataTypes.json');

  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(filePath, result);
  return result;
}

export async function getTypesFolder(usernameOrAlias: string): Promise<string> {
  if (!hasRootWorkspace()) {
    const err = nls.localize('cannot_determine_workspace');
    telemetryService.sendError(err);
    throw new Error(err);
  }
  const workspaceRootPath = getRootWorkspacePath();
  const username =
    (await OrgAuthInfo.getUsername(usernameOrAlias)) || usernameOrAlias;
  const metadataTypesPath = path.join(
    workspaceRootPath,
    '.sfdx',
    'orgs',
    username,
    'metadata'
  );
  return metadataTypesPath;
}

export type MetadataObject = {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix: string;
  xmlName: string;
};

export function buildTypesList(
  metadataFile?: any,
  metadataTypesPath?: string
): string[] {
  if (isNullOrUndefined(metadataFile)) {
    try {
      metadataFile = fs.readFileSync(metadataTypesPath!, 'utf8');
    } catch (e) {
      throw e;
    }
  }
  const jsonObject = JSON.parse(metadataFile);
  const metadataObjects = jsonObject.result.metadataObjects as MetadataObject[];
  const metadataTypes = [];
  for (const type of metadataObjects) {
    if (!isNullOrUndefined(type.xmlName)) {
      metadataTypes.push(type.xmlName);
    }
  }
  telemetryService.sendEventData('Metadata Types Quantity', undefined, {
    metadataTypes: metadataTypes.length
  });
  return metadataTypes;
}
