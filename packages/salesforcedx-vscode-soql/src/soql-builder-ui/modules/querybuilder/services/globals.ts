/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

export const getWindow = (): Window => {
  return window;
};

export const getBodyClass = (): string | null => {
  return window.document.body.getAttribute('class');
};

export const getLocalStorage = (): Storage => {
  return localStorage;
};

/* eslint-disable @typescript-eslint/ban-ts-comment,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call */

let vsCode;

export const getVscode = (): unknown => {
  if (!vsCode) {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    vsCode = acquireVsCodeApi();
  }
  return vsCode;
};
