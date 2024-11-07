/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancelResponse, ContinueResponse, PostconditionChecker } from '@salesforce/salesforcedx-utils-vscode';

export class CompositePostconditionChecker<T> implements PostconditionChecker<T> {
  private readonly postCheckers: PostconditionChecker<any>[];
  public constructor(...postCheckers: PostconditionChecker<any>[]) {
    this.postCheckers = postCheckers;
  }

  public async check(inputs: CancelResponse | ContinueResponse<T>): Promise<CancelResponse | ContinueResponse<T>> {
    if (inputs.type === 'CONTINUE') {
      for (const postChecker of this.postCheckers) {
        inputs = await postChecker.check(inputs);
        if (inputs.type !== 'CONTINUE') {
          return {
            type: 'CANCEL'
          };
        }
      }
    }

    return inputs;
  }
}
