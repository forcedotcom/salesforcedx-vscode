/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { ApexTestMethod } from '../../../src/views/lspConverter';

export const generateApexTestMethod = (namespace?: string): ApexTestMethod[] => {
  const apexTestInfo: ApexTestMethod[] = new Array<ApexTestMethod>();
  // All test methods, has same info as file1, file2, file3, file4
  for (let i = 0; i < 8; i++) {
    const methodName = `test${i}`;
    const fileName = 'file' + Math.floor(i / 2); // Parent is either file1, file2, file3, or file4
    const definingType = namespace ? `${namespace}.${fileName}` : fileName;
    const line = (i / 2) * 4 + 3;
    const startPos = new vscode.Position(line, 0);
    const endPos = new vscode.Position(line, 5);
    const file = `/bogus/path/to/${fileName}.cls`;
    const uri = vscode.Uri.file(file);
    const location = new vscode.Location(uri, new vscode.Range(startPos, endPos));
    const testInfo: ApexTestMethod = {
      methodName,
      definingType,
      location
    };
    apexTestInfo.push(testInfo);
  }
  return apexTestInfo;
};
