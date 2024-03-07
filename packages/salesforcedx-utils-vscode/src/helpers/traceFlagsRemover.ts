/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core-bundle';

/**
 * TraceFlagsRemover is a singleton which deletes trace flags created by the extensions.
 */
export class TraceFlagsRemover {
  private static _instance: TraceFlagsRemover | undefined;
  private connection: Connection;
  private newTraceFlagIds = new Array<string>();

  private constructor(connection: Connection) {
    if (!connection) {
      throw Error('connection passed to TraceFlagsRemover is invalid');
    }

    this.connection = connection;
  }

  public static getInstance(connection: Connection): TraceFlagsRemover {
    if (!TraceFlagsRemover._instance) {
      TraceFlagsRemover._instance = new TraceFlagsRemover(connection);
    }

    return TraceFlagsRemover._instance;
  }

  public static resetInstance() {
    TraceFlagsRemover._instance = undefined;
  }

  public addNewTraceFlagId(newTraceFlagId: string) {
    if (!newTraceFlagId) {
      return;
    }

    this.newTraceFlagIds.push(newTraceFlagId);
  }

  public async removeNewTraceFlags() {
    while (this.newTraceFlagIds && this.newTraceFlagIds.length > 0) {
      const newTraceFlagId = this.newTraceFlagIds.pop();
      if (newTraceFlagId) {
        await this.connection.tooling.delete('TraceFlag', newTraceFlagId);
      }
    }
  }
}
