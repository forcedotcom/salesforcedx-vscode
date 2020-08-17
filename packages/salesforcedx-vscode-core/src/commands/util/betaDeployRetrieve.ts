/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  RegistryAccess,
  registryData
} from '@salesforce/source-deploy-retrieve';
import { MetadataComponent } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { sfdxCoreSettings } from '../../settings';

export function useBetaDeployRetrieve(explorerPath: vscode.Uri[]): boolean {
  if (explorerPath.length > 1) {
    return false;
  }
  const filePath = explorerPath[0].fsPath;
  const betaDeployRetrieve = sfdxCoreSettings.getBetaDeployRetrieve();
  const registry = new RegistryAccess();
  const component = registry.getComponentsFromPath(filePath)[0];
  const typeName = component.type.name;
  const {
    auradefinitionbundle,
    lightningcomponentbundle,
    apexclass,
    apexcomponent,
    apexpage,
    apextrigger
  } = registryData.types;

  const supportedType =
    typeName === auradefinitionbundle.name ||
    typeName === lightningcomponentbundle.name ||
    typeName === apexclass.name ||
    typeName === apexcomponent.name ||
    typeName === apexpage.name ||
    typeName === apextrigger.name;
  return betaDeployRetrieve && supportedType;
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
