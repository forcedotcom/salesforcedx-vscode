/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';

class MockMemento {
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

class MockEnvironmentVariableCollection {
  public persistent = true;
  public replace(variable: string, value: string): void {
    throw new Error('Method not implemented.');
  }
  public append(variable: string, value: string): void {
    throw new Error('Method not implemented.');
  }
  public prepend(variable: string, value: string): void {
    throw new Error('Method not implemented.');
  }
  public get(variable: string) {
    throw new Error('Method not implemented.');
  }
  public forEach(
    callback: (
      variable: string,
      mutator: any,
      collection: any
    ) => any,
    thisArg?: any
  ): void {
    throw new Error('Method not implemented.');
  }
  public delete(variable: string): void {
    throw new Error('Method not implemented.');
  }
  public clear(): void {
    throw new Error('Method not implemented.');
  }
}

export class MockContext {
  constructor(mm: boolean) {
    this.globalState = new MockMemento(mm);
  }
  public extensionUri = 'file://test';
  public environmentVariableCollection = new MockEnvironmentVariableCollection();
  public subscriptions: Array<{ dispose(): any }> = [];
  public workspaceState!: any;
  public globalState: any;
  public extensionPath: string = 'myExtensionPath';
  public globalStoragePath = 'globalStatePath';
  public logPath = 'logPath';
  public asAbsolutePath(relativePath: string): string {
    return path.join('../../../package.json'); // this should point to the src/package.json
  }
  public storagePath: string = 'myStoragePath';
}
