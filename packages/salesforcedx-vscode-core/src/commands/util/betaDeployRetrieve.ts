/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  MetadataType,
  RegistryAccess
} from '@salesforce/source-deploy-retrieve';
import { MetadataComponent } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { sfdxCoreSettings } from '../../settings';

export function useBetaDeployRetrieve(uris: vscode.Uri[], supportedTypes?: MetadataType[]): boolean {
  const betaSettingOn = sfdxCoreSettings.getBetaDeployRetrieve();
  if (!betaSettingOn) {
    return false;
  }

  const registry = new RegistryAccess();
  const permittedTypeNames = new Set();
  supportedTypes?.forEach(type => permittedTypeNames.add(type.name));

  for (const { fsPath } of uris) {
    const componentsForPath = registry.getComponentsFromPath(fsPath);
    if (supportedTypes) {
      for (const component of componentsForPath) {
        if (!permittedTypeNames.has(component.type.name)) {
          return false;
        }
      }
    }
  }

  return true;
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
