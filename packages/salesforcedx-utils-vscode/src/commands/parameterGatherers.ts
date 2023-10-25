/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CancelResponse, ContinueResponse, ParametersGatherer } from '../types';

export class CompositeParametersGatherer<T> implements ParametersGatherer<T> {
  private readonly gatherers: ParametersGatherer<any>[];
  public constructor(...gatherers: ParametersGatherer<any>[]) {
    this.gatherers = gatherers;
  }
  public async gather(): Promise<CancelResponse | ContinueResponse<T>> {
    const aggregatedData: any = {};
    for (const gatherer of this.gatherers) {
      const input = await gatherer.gather();
      if (input.type === 'CONTINUE') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        Object.keys(input.data).map(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-member-access
          key => (aggregatedData[key] = input.data[key])
        );
      } else {
        return {
          type: 'CANCEL'
        };
      }
    }
    return {
      type: 'CONTINUE',
      data: aggregatedData as T
    };
  }
}

export class EmptyParametersGatherer implements ParametersGatherer<unknown> {
  public gather(): Promise<CancelResponse | ContinueResponse<unknown>> {
    return Promise.resolve({ type: 'CONTINUE', data: {} });
  }
}
