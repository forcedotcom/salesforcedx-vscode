/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
   */
  public registerStartedFunction(terminable: Terminable) {
    this.startedExecutions.add(terminable);
  }

  /**
   * Stop all started function containers
   */
  public async stopFunction() {
    return Promise.all(
      [...this.startedExecutions].map(terminable => {
        return terminable.terminate();
      })
    );
  }
}
