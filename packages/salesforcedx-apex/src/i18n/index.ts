/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { messages } from './i18n';
import { Localization, Message } from './localization';

function loadMessageBundle(): Message {
  try {
    const layer = new Message(messages);
    return layer;
  } catch (e) {
    console.error('Cannot find messages in i18n module');
  }
}

export const nls = new Localization(loadMessageBundle());
export { Localization, Message } from './localization';
