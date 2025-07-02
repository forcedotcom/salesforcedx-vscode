/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode';

export class CompositePreconditionChecker implements PreconditionChecker {
  public checks: PreconditionChecker[];

  constructor(...checks: PreconditionChecker[]) {
    this.checks = checks;
  }

  public async check(): Promise<boolean> {
    for (const output of this.checks) {
      const input = await output.check();
      if (input === false) {
        return false;
      }
    }

    return true;
  }
}
