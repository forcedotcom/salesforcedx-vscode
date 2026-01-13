/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { getBodyClass, getWindow, hasVscode } from './globals';
import { getLocalStorage } from './globals';
describe('Globals should', () => {
  it('expose window', () => {
    expect(getWindow()).toBeTruthy();
  });
  it('expose getBodyClass', () => {
    expect(getBodyClass).toBeTruthy();
  });
  it('expose localstorage', () => {
    expect(getLocalStorage).toBeTruthy();
  });
  it('expose vscode', () => {
    expect(hasVscode()).toBeTruthy();
  });
});
