/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type VSCodeWebviewApi = {
  readonly getState: () => unknown;
  readonly postMessage: (message: unknown) => void;
  readonly setState: (state: unknown) => void;
};

declare global {
  var acquireVsCodeApi: () => VSCodeWebviewApi;
}

export const getWindow = (): Window => window;

export const getBodyClass = (): string | null => window.document.body.getAttribute('class');

let vsCode: VSCodeWebviewApi | undefined;

export const getVscode = (): VSCodeWebviewApi => {
  if (vsCode === undefined) {
    vsCode = globalThis.acquireVsCodeApi();
  }
  return vsCode;
};
