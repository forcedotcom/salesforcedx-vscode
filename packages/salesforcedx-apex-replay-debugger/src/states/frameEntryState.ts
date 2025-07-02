/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Source, StackFrame } from '@vscode/debugadapter';
import { basename } from 'node:path';
import { URI } from 'vscode-uri';
import { ApexDebugStackFrameInfo } from '../adapter/apexDebugStackFrameInfo';
import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';
import { FrameState } from './frameState';

export class FrameEntryState extends FrameState implements DebugLogState {
  public handle(logContext: LogContext): boolean {
    const sourceUri = logContext.getUriFromSignature(this._signature);
    const frame = new ApexDebugStackFrameInfo(logContext.getFrames().length, this._signature);
    const id = logContext.getFrameHandler().create(frame);
    const className = this._signature.includes('.')
      ? this._signature.substring(0, this._signature.lastIndexOf('.'))
      : this._signature;
    if (logContext.getStaticVariablesClassMap().has(className)) {
      frame.statics = logContext.getStaticVariablesClassMap().get(className)!;
    } else {
      logContext.getStaticVariablesClassMap().set(className, frame.statics);
    }
    logContext
      .getFrames()
      .push(
        new StackFrame(
          id,
          this._frameName,
          sourceUri ? new Source(basename(sourceUri), URI.parse(sourceUri).fsPath) : undefined,
          undefined
        )
      );
    return false;
  }
}
