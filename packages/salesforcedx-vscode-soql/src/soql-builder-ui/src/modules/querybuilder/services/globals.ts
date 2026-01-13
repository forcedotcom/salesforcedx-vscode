/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

export function getWindow(): Window {
  return window;
}

export function getBodyClass(): string | null {
  return window.document.body.getAttribute('class');
}

export function getLocalStorage(): Storage {
  return localStorage;
}

/* eslint-disable @typescript-eslint/ban-ts-comment,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call */

export function hasVscode(): boolean {
  // @ts-ignore
  return 'undefined' !== typeof acquireVsCodeApi;
}

let vsCode;

export function getVscode(): unknown {
  if (hasVscode()) {
    if (!vsCode) {
      // @ts-ignore
      // eslint-disable-next-line no-undef
      vsCode = acquireVsCodeApi();
    }

    return vsCode;
  }
  return false;
}
