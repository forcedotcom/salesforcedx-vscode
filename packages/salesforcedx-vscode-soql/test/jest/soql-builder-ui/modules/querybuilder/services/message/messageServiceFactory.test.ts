/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { MessageServiceFactory } from '../../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/messageServiceFactory';
import { VscodeMessageService } from '../../../../../../../src/soql-builder-ui/modules/querybuilder/services/message/vscodeMessageService';

describe('Message Service Factory', () => {
  it('should create VscodeMessageService', () => {
    const messageService = MessageServiceFactory.create();
    expect(messageService.constructor).toBe(VscodeMessageService);
  });
});
