/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import {
  EnvironmentVariableCollection,
  EnvironmentVariableMutator,
  ExtensionContext,
  ExtensionMode,
  Memento,
  Uri
} from 'vscode';

class MockMemento implements Memento {
  private telemetryGS: boolean;
  private keys: string[] = [];
  private values: any[] = [];

  constructor(setTelemetryGlobalState: boolean) {
    this.telemetryGS = setTelemetryGlobalState;
  }

  private getIndex(key: string): number {
    return this.keys.findIndex( value => value === key);
  }

  public get<T>(key: string): T {
    if (this.telemetryGS === true) {
      return true as any;
    }
    const index = this.getIndex(key);
    return index !== -1 ? this.values[index] : undefined;
  }

  public update(key: string, value: any): Promise<void> {
    const index = this.getIndex(key);
    if (index !== -1) {
      this.values[index] = value;
    } else {
      this.keys.push(key);
      this.values.push(value);
    }
    return Promise.resolve();
  }
}

class MockEnvironmentVariableCollection
  implements EnvironmentVariableCollection {
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
  public get(variable: string): EnvironmentVariableMutator | undefined {
    throw new Error('Method not implemented.');
  }
  public forEach(
    callback: (
      variable: string,
      mutator: EnvironmentVariableMutator,
      collection: EnvironmentVariableCollection
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

export class MockContext implements ExtensionContext {
  constructor(mm: boolean) {
    this.globalState = new MockMemento(mm);
    this.workspaceState = new MockMemento(false);
  }
  public storageUri: Uri | undefined;
  public globalStorageUri = Uri.parse('file://globalStorage');
  public logUri = Uri.parse('file://logs');
  public extensionMode = ExtensionMode.Test;
  public extensionUri = Uri.parse('file://test');
  public environmentVariableCollection = new MockEnvironmentVariableCollection();
  public subscriptions: Array<{ dispose(): any }> = [];
  public workspaceState: Memento;
  public globalState: Memento;
  public extensionPath: string = 'myExtensionPath';
  public globalStoragePath = 'globalStatePath';
  public logPath = 'logPath';
  public asAbsolutePath(relativePath: string): string {
    return path.join('../../../package.json'); // this should point to the src/package.json
  }
  public storagePath: string = 'myStoragePath';
}
