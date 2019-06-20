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
import { isNullOrUndefined } from 'util';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '../commands';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';

export const folderTypes = new Set(['EmailTemplate', 'Report']);
export class ForceListMetadataExecutor extends SfdxCommandletExecutor<string> {
  private metadataType: string;
  private defaultUsernameOrAlias: string;

  public constructor(metadataType: string, defaultUsernameOrAlias: string) {
    super();
    this.metadataType = metadataType;
    this.defaultUsernameOrAlias = defaultUsernameOrAlias;
  }

  public build(data: {}): Command {
    let builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_list_metadata_text'))
      .withArg('force:mdapi:listmetadata')
      .withFlag('-m', this.metadataType)
      .withFlag('-u', this.defaultUsernameOrAlias)
      .withJson();

    if (folderTypes.has(this.metadataType)) {
      builder = builder.withFlag('--folder', 'unfiled$public');
    }
    return builder.build();
  }
}

export async function forceListMetadata(
  metadataType: string,
  defaultUsernameOrAlias: string,
  outputPath: string
): Promise<string> {
  const execution = new CliCommandExecutor(
    new ForceListMetadataExecutor(metadataType, defaultUsernameOrAlias).build(
      {}
    ),
    { cwd: getRootWorkspacePath() }
  ).execute();

  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(outputPath, result);
  return result;
}

export async function getComponentsPath(
  metadataType: string,
  defaultUsernameOrAlias: string
): Promise<string> {
  if (!hasRootWorkspace()) {
    const err = nls.localize('cannot_determine_workspace');
    telemetryService.sendError(err);
    throw new Error(err);
  }

  const workspaceRootPath = getRootWorkspacePath();

  const username =
    (await OrgAuthInfo.getUsername(defaultUsernameOrAlias)) ||
    defaultUsernameOrAlias;

  const componentsPath = path.join(
    workspaceRootPath,
    '.sfdx',
    'orgs',
    username,
    'metadata',
    metadataType + '.json'
  );
  return componentsPath;
}

export function buildComponentsList(
  metadataType: string,
  componentsList?: string,
  componentsPath?: string
): string[] {
  const components = [];
  if (isNullOrUndefined(componentsList)) {
    try {
      componentsList = fs.readFileSync(componentsPath!, 'utf8');
    } catch (e) {
      throw e;
    }
  }

  const fileObject = JSON.parse(componentsList);
  let fileArray = fileObject.result;
  if (!isNullOrUndefined(fileArray)) {
    fileArray = fileArray instanceof Array ? fileArray : [fileArray];
    for (const component of fileArray) {
      if (!isNullOrUndefined(component.fullName)) {
        components.push(component.fullName);
      }
    }
  }
  telemetryService.sendEventData(
    'Metadata Components quantity',
    { metadataType },
    { metadataComponents: components.length }
  );
  return components;
  /* try {
    const metaComponents = [];
    const fileData = fs.readFileSync(componentsPath, 'utf8');
    if (fileData !== 'undefined') {
      const fileObject = JSON.parse(fileData);
      const cmpList = fileObject instanceof Array ? fileObject : [fileObject];
      for (const component of cmpList) {
        if (!isNullOrUndefined(component.fullName)) {
          metaComponents.push(component.fullName);
        }
      }
    }
    telemetryService.sendEventData(
      'Metadata Components quantity',
      { metadataType },
      { metadataComponents: metaComponents.length }
    );
    return metaComponents;
  } catch (e) {
    telemetryService.sendError(e);
    throw new Error(e);
  }*/
}
