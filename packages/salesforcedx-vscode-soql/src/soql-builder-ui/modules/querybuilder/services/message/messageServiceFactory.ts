/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { hasVscode } from '../globals';
import { VscodeMessageService } from './vscodeMessageService';
import { StandaloneMessageService } from './standaloneMessageService';
import { IMessageService } from './iMessageService';

export class MessageServiceFactory {
  public static create(): IMessageService {
    if (hasVscode()) {
      return new VscodeMessageService();
    }
    return new StandaloneMessageService();
  }
}
