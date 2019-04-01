/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import * as path from 'path';
import { isNullOrUndefined } from 'util';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../commands';
import { nls } from '../messages';
import { getRootWorkspacePath } from '../util';

export class ForceDescribeMetadataExecutor extends SfdxCommandletExecutor<string> {
  public build(data: string): Command {
    const filePath = path.join(getRootWorkspacePath(), '.sfdx', 'tools', 'metadata', 'metadataTypes.json');
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('')
      )
      .withArg('force:mdapi:describemetadata')
      .withJson()
      .withFlag('-f', filePath)
      .withLogName('force_describe_metadata')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const describeExecutor = new ForceDescribeMetadataExecutor();

export async function forceDescribeMetadata() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    describeExecutor
  );
  await commandlet.run();
  buildTypeList();
}

export type MetadataObject = {
  directoryName: string;
  inFolder: boolean;
  metaFile: boolean;
  suffix: string;
  xmlName: string;
};

export function buildTypeList() {
  const filePath = path.join(getRootWorkspacePath(), '.sfdx', 'tools', 'metadata', 'metadataTypes.json');
  if (fs.existsSync(filePath)) {
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const metadataObjects = fileData.metadataObjects;
    const metadataTypes = [];
    for (const index in metadataObjects) {
      if (!isNullOrUndefined(metadataObjects[index].xmlName)) {
        metadataTypes.push(metadataObjects[index].xmlName);
      }
    }
    console.log(metadataTypes);
  }
}
