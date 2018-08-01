/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { ExtensionContext, Memento } from 'vscode';

class MockMemento implements Memento {
  private telemetryGS: boolean;

  constructor(setGlobalState: boolean) {
    this.telemetryGS = setGlobalState;
  }

  public get(key: string): any {
    if (this.telemetryGS === true) {
      return true;
    }
    return undefined;
  }

  public update(key: string, value: any): Promise<void> {
    return Promise.resolve();
  }
}

export class MockContext implements ExtensionContext {
  constructor(mm: boolean) {
    this.globalState = new MockMemento(mm);
  }
  public subscriptions: Array<{ dispose(): any }> = [];
  public workspaceState: Memento;
  public globalState: Memento;
  public extensionPath: string = 'myExtensionPath';
  public asAbsolutePath(relativePath: string): string {
    return path.join('../../../package.json'); // this should point to the src/package.json
  }
  public storagePath: string = 'myStoragePath';
}
