/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { TextDocument } from 'vscode';

export function getDocumentName(document: TextDocument): string {
  const documentPath = document.uri.fsPath;
  return path.basename(documentPath) || '';
}
