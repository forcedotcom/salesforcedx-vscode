/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { messages as enMessages } from './i18n';

type MessageKey = keyof typeof enMessages;

export const messages: Partial<Record<MessageKey, string>> = {};
