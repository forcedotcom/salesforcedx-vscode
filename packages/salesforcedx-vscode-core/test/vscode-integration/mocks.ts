/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EOL } from 'os';
import { stub } from 'sinon';

export class MockChannel {
  public readonly name = 'MockChannel';
  public value = '';

  public append(value: string): void {
    this.value += value;
  }

  public appendLine(value: string): void {
    this.value += value;
    this.value += EOL;
  }

  public clear(): void {}
  public show(preserveFocus?: boolean | undefined): void;
  public show(column?: any, preserveFocus?: any) {}
  public hide(): void {}
  public dispose(): void {}
  public replace(value: string): void {}
}

export const vscodeStub = {
  CancellationTokenSource: class {
    public listeners: any[] = [];
    public token = {
      isCancellationRequested: false,
      onCancellationRequested: (listener: any) => {
        this.listeners.push(listener);
        return {
          dispose: () => {
            this.listeners = [];
          }
        };
      }
    };
    public cancel = () => {
      this.listeners.forEach(listener => {
        listener.call();
      });
    };
    public dispose = () => {};
  },
  commands: stub(),
  Disposable: stub(),
  env: {
    machineId: '12345534'
  },
  Uri: {
    parse: stub()
  },
  ProgressLocation: {
    SourceControl: 1,
    Window: 10,
    Notification: 15
  },
  window: {
    showInformationMessage: () => {
      return Promise.resolve(null);
    },
    showWarningMessage: () => {
      return Promise.resolve(null);
    },
    showErrorMessage: () => {
      return Promise.resolve(null);
    },
    setStatusBarMessage: () => {
      return Promise.resolve(null);
    },
    withProgress: () => {
      return Promise.resolve(true);
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createOutputChannel: mockChannel => {
      return mockChannel;
    },
    OutputChannel: { show: () => {} }
  },
  workspace: {
    getConfiguration: () => {
      return {
        get: () => true,
        update: () => true
      };
    },
    onDidChangeConfiguration: stub()
  }
};
