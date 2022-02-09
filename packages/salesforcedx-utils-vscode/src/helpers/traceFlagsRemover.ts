/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';

/**
 * TraceFlagsRemover is a singleton which deletes trace flags not created by the user.
 */
export class TraceFlagsRemover {
  private static _instance: TraceFlagsRemover;

  private connection: Connection;
  private newTraceFlagIds = new Array<string>();

  private constructor(connection: Connection) {
    this.connection = connection;
  }

  public static getInstance(connection: Connection | undefined): TraceFlagsRemover {
    if (!TraceFlagsRemover._instance) {
      if (!connection) {
        throw Error('When TraceFlagsRemover is created, connection must be passed');
      }

      TraceFlagsRemover._instance = new TraceFlagsRemover(connection);
    }

    return TraceFlagsRemover._instance;
  }

  public addNewTraceFlagId(newTraceFlagId: string) {
    if (!newTraceFlagId) {
      return;
    }

    this.newTraceFlagIds.push(newTraceFlagId);
  }

  public removeNewTraceFlags() {
    while (this.newTraceFlagIds.length > 0) {
      const newTraceFlagId = this.newTraceFlagIds.pop();
      if (newTraceFlagId) {
        const result = this.connection.tooling.delete('TraceFlag', newTraceFlagId);
      }
    }
  }
}
