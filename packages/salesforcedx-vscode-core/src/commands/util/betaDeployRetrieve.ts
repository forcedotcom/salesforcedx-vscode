/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  RegistryAccess,
  registryData,
  SourceComponent
} from '@salesforce/source-deploy-retrieve';
import { MetadataComponent } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { sfdxCoreSettings } from '../../settings';

export function useBetaDeployRetrieve(explorerPath: vscode.Uri[]): boolean {
  const betaDeployRetrieve = sfdxCoreSettings.getBetaDeployRetrieve();
  const registry = new RegistryAccess();
  const {
    auradefinitionbundle,
    lightningcomponentbundle,
    apexclass,
    apexcomponent,
    apexpage,
    apextrigger
  } = registryData.types;

  const components: SourceComponent[] = [];
  for (const expPath of explorerPath) {
    const filePath = expPath.fsPath;
    components.push(...registry.getComponentsFromPath(filePath));
  }
  for (const cmp of components) {
    const typeName = cmp.type.name;
    if (
      !(
        typeName === auradefinitionbundle.name ||
        typeName === lightningcomponentbundle.name ||
        typeName === apexclass.name ||
        typeName === apexcomponent.name ||
        typeName === apexpage.name ||
        typeName === apextrigger.name
      )
    ) {
      return false;
    }
  }
  return betaDeployRetrieve;
}

export function createComponentCount(components: MetadataComponent[]) {
  const quantities: { [type: string]: number } = {};
  for (const component of components) {
    const { name: typeName } = component.type;
    const typeCount = quantities[typeName];
    quantities[typeName] = typeCount ? typeCount + 1 : 1;
  }
  return Object.keys(quantities).map(type => ({
    type,
    quantity: quantities[type]
  }));
}
