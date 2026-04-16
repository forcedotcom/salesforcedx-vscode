/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNls } from '@salesforce/vscode-i18n';
import { EXTENSION_NAME } from '../constants';
import { messages as enMessages } from './i18n';
import { messages as jaMessages } from './i18n.ja';

export const nls = createNls({ instanceName: EXTENSION_NAME, messages: enMessages, jaMessages });
