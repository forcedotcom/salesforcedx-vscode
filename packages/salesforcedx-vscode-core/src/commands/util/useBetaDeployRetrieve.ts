import {
  RegistryAccess,
  registryData
} from '@salesforce/source-deploy-retrieve';
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
