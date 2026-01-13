/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { MessageServiceFactory } from './messageServiceFactory';
import { StandaloneMessageService } from './standaloneMessageService';
import { VscodeMessageService } from './vscodeMessageService';

describe('Message Service Factory', () => {
  it('will switch implementation based on vscode', () => {
    // @ts-ignore
    const original = global.acquireVsCodeApi;
    // @ts-ignore
    global.acquireVsCodeApi = undefined;
    const standardMessageService = MessageServiceFactory.create();
    expect(standardMessageService.constructor).toBe(StandaloneMessageService);
    // @ts-ignore
    global.acquireVsCodeApi = original;
    const vscodeMessageService = MessageServiceFactory.create();
    expect(vscodeMessageService.constructor).toBe(VscodeMessageService);
  });
});
