/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename } from 'path';
import { Source, StackFrame } from 'vscode-debugadapter';
import Uri from 'vscode-uri';
import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class FrameEntryState implements DebugLogState {
  private readonly signature: string;

  constructor(fields: string[]) {
    this.signature = fields[fields.length - 1];
  }

  public handle(logContext: LogContext): boolean {
    const sourceUri = logContext.getUriFromSignature(this.signature);
    logContext
      .getFrames()
      .push(
      new StackFrame(
        logContext.getFrames().length,
        this.signature,
        sourceUri ? new Source(basename(sourceUri), Uri.parse(sourceUri).path) : undefined,
        undefined
      )
      );
    return false;
  }
}
