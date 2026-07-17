/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type ContinueResponse<T> = {
  type: 'CONTINUE';
  data: T;
};

export type CancelResponse = {
  type: 'CANCEL';
  msg?: string;
};

export type ParametersGatherer<T> = {
  gather(): Promise<CancelResponse | ContinueResponse<T>>;
};
