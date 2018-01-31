/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename } from 'path';
import { Source, StackFrame } from 'vscode-debugadapter';
import Uri from 'vscode-uri';
import { SFDC_TRIGGER } from '../constants';
import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class FrameEntryState implements DebugLogState {
  private readonly signature: string;
  private readonly frameName: string;

  constructor(fields: string[]) {
    this.signature = fields[fields.length - 1];
    if (this.signature.startsWith(SFDC_TRIGGER)) {
      this.frameName = this.signature.substring(SFDC_TRIGGER.length);
    } else {
      this.frameName = this.signature;
    }
  }

  public handle(logContext: LogContext): boolean {
    const sourceUri = logContext.getUriFromSignature(this.signature);
    logContext
      .getFrames()
      .push(
        new StackFrame(
          logContext.getFrames().length,
          this.frameName,
          sourceUri
            ? new Source(basename(sourceUri), Uri.parse(sourceUri).path)
            : undefined,
          undefined
        )
      );
    return false;
  }
}
