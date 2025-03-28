/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

const extensionUri = (extensionName: string) => {
  const extensionRef = vscode.extensions.getExtension(extensionName);

  if (extensionRef) {
    return extensionRef.extensionUri;
  }
  throw new Error(`Unable to find extension ${extensionName}`);
};

const join = (baseUri: vscode.Uri, relativePath: string) => vscode.Uri.joinPath(baseUri, relativePath);

export const extensionUris = {
  extensionUri,
  join
};
