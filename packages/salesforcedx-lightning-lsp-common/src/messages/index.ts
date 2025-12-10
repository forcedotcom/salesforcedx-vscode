/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNls } from '@salesforce/vscode-i18n';
import { messages as enMessages } from './i18n';
// import { messages as jaMessages } from './i18n.ja'; // No Japanese messages yet

export const nls = createNls({ instanceName: 'salesforcedx-lightning-lsp-common', messages: enMessages });
