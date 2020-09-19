/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Disposable } from 'vscode';

/**
 * A running task that can be terminated
 */
interface Terminable {
  terminate: () => Promise<void>;
}

export class FunctionService {
  private static _instance: FunctionService;
  public static get instance() {
    if (FunctionService._instance === undefined) {
      FunctionService._instance = new FunctionService();
    }
    return FunctionService._instance;
  }
  private startedExecutions: Set<Terminable> = new Set();

  /**
   * Register started functions, in order to terminate the container.
   * Returns a disposable to unregister in case an error happens when starting function
   *
   * @returns {Disposable} disposable to unregister
   */
  public registerStartedFunction(terminable: Terminable): Disposable {
    this.startedExecutions.add(terminable);
    return {
      dispose: () => {
        this.startedExecutions.delete(terminable);
      }
    };
  }

  public isFunctionStarted() {
    return this.startedExecutions.size > 0;
  }

  /**
   * Stop all started function containers
   */
  public async stopFunction() {
    await Promise.all(
      [...this.startedExecutions].map(terminable => {
        return terminable.terminate();
      })
    );
    this.startedExecutions.clear();
  }
}
