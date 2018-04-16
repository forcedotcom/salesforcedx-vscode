/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseDebuggerCommand } from './baseDebuggerCommand';

export class FrameCommand extends BaseDebuggerCommand {
  public constructor(debuggedRequestId: string, frameId: number) {
    super('frame', debuggedRequestId, `stackFrame=${frameId}`);
  }
}
