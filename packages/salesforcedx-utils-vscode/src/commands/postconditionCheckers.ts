/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CancelResponse, ContinueResponse, PostconditionChecker } from '../types';

export class EmptyPostChecker implements PostconditionChecker<any> {
  public async check(inputs: ContinueResponse<any> | CancelResponse): Promise<ContinueResponse<any> | CancelResponse> {
    return inputs;
  }
}
