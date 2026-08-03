/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { StoredViewState } from './types';

type VsCodeApi<State> = {
  readonly postMessage: (message: unknown) => void;
  readonly getState: () => State | undefined;
  readonly setState: (state: State) => State;
};

declare const acquireVsCodeApi: <State>() => VsCodeApi<State>;

export const vscode = acquireVsCodeApi<StoredViewState>();
