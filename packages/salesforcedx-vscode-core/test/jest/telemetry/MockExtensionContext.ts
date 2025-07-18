/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import {
  EnvironmentVariableCollection,
  EnvironmentVariableMutator,
  EnvironmentVariableScope,
  EventEmitter,
  Extension,
  ExtensionContext,
  ExtensionMode,
  LanguageModelAccessInformation,
  LanguageModelChat,
  Memento,
  SecretStorage,
  Uri
} from 'vscode';

class MockMemento implements Memento {
  private keyValues: string[] = [];
  private values: any[] = [];

  private getIndex(key: string): number {
    return this.keys().findIndex(value => value === key);
  }

  public keys() {
    const readOnlyKeys: readonly string[] = [...this.keyValues];
    return readOnlyKeys;
  }

  public get<T>(key: string): T | undefined {
    const index = this.getIndex(key);
    return index !== -1 ? this.values[index] : undefined;
  }

  public update(key: string, value: any): Promise<void> {
    const index = this.getIndex(key);
    if (index !== -1) {
      this.values[index] = value;
    } else {
      this.keyValues.push(key);
      this.values.push(value);
    }
    return Promise.resolve();
  }

  public setKeysForSync(keys: readonly string[]): void {}
}

class MockEnvironmentVariableCollection implements EnvironmentVariableCollection {
  public [Symbol.iterator](): Iterator<[variable: string, mutator: EnvironmentVariableMutator], any, undefined> {
    throw new Error('Method not implemented.');
  }
  public persistent = true;
  public description = 'Mock Environment Variable Collection';
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
    callback: (variable: string, mutator: EnvironmentVariableMutator, collection: EnvironmentVariableCollection) => any,
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
  public getScoped(scope: EnvironmentVariableScope): EnvironmentVariableCollection {
    const envVar: any = null;
    return envVar;
  }
}

export class MockExtensionContext implements ExtensionContext {
  constructor(mode?: ExtensionMode) {
    this.extensionMode = mode ?? ExtensionMode.Test;
    this.globalState = new MockMemento();
    this.workspaceState = new MockMemento();
    this.secrets = {
      onDidChange: {} as any,
      get: (key: string): Thenable<string | undefined> => Promise.resolve(undefined),
      store: (key: string, value: string): Thenable<void> => Promise.resolve(),
      delete: (key: string): Thenable<void> => Promise.resolve()
    };
    this.extension = {
      packageJSON: {
        name: 'salesforcedx-vscode-core',
        version: 'v55.5.5'
      }
    } as any;
  }
  public secrets: SecretStorage;
  public extension: Extension<any>;
  public storageUri: Uri | undefined;
  public globalStorageUri = Uri.parse('file://globalStorage');
  public logUri = Uri.parse('file://logs');
  public extensionMode: ExtensionMode;
  public extensionUri = Uri.parse('file://test');
  public environmentVariableCollection = new MockEnvironmentVariableCollection();
  public subscriptions: { dispose(): any }[] = [];
  public workspaceState: Memento;
  public globalState: Memento & { setKeysForSync(keys: readonly string[]): void };
  public extensionPath: string = 'myExtensionPath';
  public globalStoragePath = 'globalStatePath';
  public logPath = 'logPath';
  public asAbsolutePath(relativePath: string): string {
    return path.join('../../../package.json'); // this should point to the src/package.json
  }
  public storagePath: string = 'myStoragePath';
  public languageModelAccessInformation: LanguageModelAccessInformation = {
    onDidChange: new EventEmitter<void>().event,
    canSendRequest: (chat: LanguageModelChat) =>
      // Implement your logic here
      // For example, return true, false, or undefined based on some condition
      true // or false or undefined
  };
}
