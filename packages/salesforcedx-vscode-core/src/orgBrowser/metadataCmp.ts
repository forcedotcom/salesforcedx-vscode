/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullOrUndefined } from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import * as fs from 'fs';
import * as path from 'path';
import { forceListMetadata, forceSourceRetrieveCmp } from '../commands';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, hasRootWorkspace, OrgAuthInfo } from '../util';
import { BrowserNode, NodeType } from './nodeTypes';

export class ComponentUtils {
  public async getComponentsPath(
    metadataType: string,
    defaultUsernameOrAlias: string,
    folder?: string
  ): Promise<string> {
    if (!hasRootWorkspace()) {
      const err = nls.localize('cannot_determine_workspace');
      telemetryService.sendError(err);
      throw new Error(err);
    }

    const username =
      (await OrgAuthInfo.getUsername(defaultUsernameOrAlias)) ||
      defaultUsernameOrAlias;
    const fileName = `${
      folder ? `${metadataType}_${folder}` : metadataType
    }.json`;
    const componentsPath = path.join(
      getRootWorkspacePath(),
      '.sfdx',
      'orgs',
      username,
      'metadata',
      fileName
    );
    return componentsPath;
  }

  public buildComponentsList(
    metadataType: string,
    componentsFile?: string,
    componentsPath?: string
  ): string[] {
    try {
      if (isNullOrUndefined(componentsFile)) {
        componentsFile = fs.readFileSync(componentsPath!, 'utf8');
      }

      const jsonObject = JSON.parse(componentsFile);
      let cmpArray = jsonObject.result;

      const components = [];
      if (!isNullOrUndefined(cmpArray)) {
        cmpArray = cmpArray instanceof Array ? cmpArray : [cmpArray];
        for (const cmp of cmpArray) {
          if (!isNullOrUndefined(cmp.fullName)) {
            components.push(cmp.fullName);
          }
        }
      }
      telemetryService.sendEventData(
        'Metadata Components quantity',
        { metadataType },
        { metadataComponents: components.length }
      );
      return components.sort();
    } catch (e) {
      telemetryService.sendError(e);
      throw new Error(e);
    }
  }

  public async loadComponents(
    defaultOrg: string,
    metadataType: string,
    folder?: string,
    forceRefresh?: boolean
  ): Promise<string[]> {
    const componentsPath = await this.getComponentsPath(
      metadataType,
      defaultOrg,
      folder
    );

    let componentsList: string[];
    if (forceRefresh || !fs.existsSync(componentsPath)) {
      const result = await forceListMetadata(
        metadataType,
        defaultOrg,
        componentsPath,
        folder
      );
      componentsList = this.buildComponentsList(
        metadataType,
        result,
        undefined
      );
    } else {
      componentsList = this.buildComponentsList(
        metadataType,
        undefined,
        componentsPath
      );
    }
    return componentsList;
  }

  public async retrieveComponent(componentNode: BrowserNode) {
    const parentNode = componentNode.parent!;
    const typeName =
      parentNode.type === NodeType.Folder
        ? parentNode.parent!.fullName
        : parentNode.fullName;
    const componentName = componentNode.fullName;
    const metadataArg = `${typeName}:${componentName}`;
    await forceSourceRetrieveCmp(componentNode);
  }
}
