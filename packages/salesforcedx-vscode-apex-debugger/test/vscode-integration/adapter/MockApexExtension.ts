/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Extension, ExtensionKind } from 'vscode';
export class MockApexExtension implements Extension<any> {
  extensionKind = ExtensionKind.Workspace;
  constructor() {
    this.id = 'salesforce.salesforcedx-vscode-apex';
    this.extensionPath = 'extension/local/path';
    this.isActive = true;
    this.exports = new MockJorje();
  }
  public id: string;
  public extensionPath: string;
  public isActive: boolean;
  public packageJSON: any;
  public activate(): Thenable<any> {
    return Promise.resolve('activated');
  }
  public exports: any;
}

class MockJorje {
  constructor() {}
  public getLineBreakpointInfo(): Promise<{}> {
    const response = [
      {
        uri: '/force-app/main/default/classes/A.cls',
        typeref: 'A',
        lines: [2, 5, 6, 7]
      }
    ];
    return Promise.resolve(response);
  }

  public languageClientUtils = {
    getStatus() {
      return {
        isReady() {
          return true;
        },
        failedToInitialize() {
          return false;
        },
        getStatusMessage() {
          return '';
        }
      };
    }
  };
}
