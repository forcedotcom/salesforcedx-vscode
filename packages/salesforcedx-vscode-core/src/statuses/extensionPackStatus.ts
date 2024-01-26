/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

export type ExtensionInfo = {
  isActive: boolean;
  path: string;
  kind: vscode.ExtensionKind;
  uri: vscode.Uri;
};

export type ExtensionsInfo = {
  [extensionId: string]: ExtensionInfo;
};

export const collectSalesforceExtensionActivationStats = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  const checkInterval = 1_000;
  const timeout = 20_000;
  let elapsed = 0;
  let allActive = false;
  while (elapsed < timeout && !allActive) {
    allActive = checkExtensions();
    if (allActive) {
      console.log('All active:', true);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;
  }

  const extensionsInfo = await collectExtensionStartupInfo(context);
  console.log(extensionsInfo);
};

const checkExtensions = (): boolean => {
  // Check if all extensions in the extension pack are active
  return getSalesforceExtensions().every(ext => {
    return ext.isActive;
  });
};

const collectExtensionStartupInfo = async (
  context: vscode.ExtensionContext
): Promise<ExtensionsInfo> => {
  const logUri = context.logUri;
  console.log(logUri);
  const targetDir = 'exthost';
  const parts = logUri.fsPath.split(path.sep);
  const targetIndex = parts.indexOf(targetDir);

  if (targetIndex < 0) {
    return {};
  }
  const exthostDir = parts.slice(0, targetIndex + 1).join(path.sep);
  console.log(exthostDir);

  const extHostLogLines = await captureExtensionHostLog(vscode.Uri.file(exthostDir));
  console.log(extHostLogLines);
  return getSalesforceExtensions().reduce((a, ext) => {
    return {
      ...a,
      [ext.id]: {
        isActive: ext.isActive,
        path: ext.extensionPath,
        kind: ext.extensionKind,
        uri: ext.extensionUri
      }
    };
  }, {} as ExtensionsInfo);
};

const captureExtensionHostLog = async (
  logUri: vscode.Uri
): Promise<string[]> => {
  try {
    const logContents = await fs.readFile(
      path.join(logUri.fsPath, 'exthost.log'),
      'utf8'
    );
    const lines = logContents.split('\n').filter(line => line);
    console.log(lines);
    return [];
  } catch {
    return [];
  }
};

// Filter extensions that are part of the extension pack
const getSalesforceExtensions = () => {
  // Hardcoded extension pack ID
  const extensionPackId = 'salesforce.salesforcedx-vscode';
  // Find the extension pack
  const extensionPack = vscode.extensions.getExtension(extensionPackId);

  if (!extensionPack) {
    throw new Error(`Extension pack ${extensionPackId} not found`);
  }

  const x = vscode.extensions.all.filter(
    ext =>
      ext.id !== 'salesforce.salesforce-vscode-slds' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      extensionPack.packageJSON.extensionPack.includes(ext.id)
  );
  return x;
};
