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
  private telemetryGS: boolean;

  constructor(setGlobalState: boolean) {
    this.telemetryGS = setGlobalState;
  }
  keys(): readonly string[] {
    throw new Error('Method not implemented.');
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

  public setKeysForSync(keys: readonly string[]): void {
    return;
  }
}

class MockEnvironmentVariableCollection
  implements EnvironmentVariableCollection {
  [Symbol.iterator](): Iterator<[variable: string, mutator: EnvironmentVariableMutator], any, undefined> {
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
  public getScoped(scope: EnvironmentVariableScope): EnvironmentVariableCollection {
    const envVar: any = null;
    return envVar;
  }
}

export class MockExtensionContext implements ExtensionContext {
  constructor(mm: boolean) {
    this.globalState = new MockMemento(mm);
    this.workspaceState = new MockMemento(false);
    this.secrets = {
      onDidChange: {} as any,
      get: (key: string): Thenable<string | undefined> => {
        return Promise.resolve(undefined);
      },
      store: (key: string, value: string): Thenable<void> => {
        return Promise.resolve();
      },
      delete: (key: string): Thenable<void> => {
        return Promise.resolve();
      }
    };
    this.extension = {
      packageJSON: {
        aiKey: 'aabbccdd',
        name: 'salesforcedx-vscode-core',
        version: 'v55.5.5'
      }
    } as any;
  }
  public asAbsolutePath(relativePath: string): string {
    return path.join('../../../package.json'); // this should point to the src/package.json
  }
  public environmentVariableCollection =
    new MockEnvironmentVariableCollection();
  public extension: Extension<any>;
  public extensionMode = ExtensionMode.Test;
  public extensionPath: string = 'myExtensionPath';
  public extensionUri = Uri.parse('file://test');
  public globalState: Memento & {
    setKeysForSync(keys: readonly string[]): void;
  };
  public globalStoragePath = 'globalStatePath';
  public globalStorageUri = Uri.parse('file://globalStorage');
  public languageModelAccessInformation: LanguageModelAccessInformation = {
    onDidChange: new EventEmitter<void>().event,
    canSendRequest: (chat: LanguageModelChat) => {
      // Implement your logic here
      // For example, return true, false, or undefined based on some condition
      return true; // or false or undefined
    }
  };
  public logPath = 'logPath';
  public logUri = Uri.parse('file://logs');
  public secrets: SecretStorage;
  public storagePath: string = 'myStoragePath';
  public storageUri: Uri | undefined;
  public subscriptions: { dispose(): any }[] = [];
  public workspaceState: Memento;
}

