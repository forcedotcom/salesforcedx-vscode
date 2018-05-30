/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogContext } from '../core/logContext';
import { DebugLogState } from './debugLogState';

export class NoOpState implements DebugLogState {
  public handle(logContext: LogContext): boolean {
    return false;
  }
}
