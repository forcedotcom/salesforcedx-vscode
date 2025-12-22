/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { createNls } from '@salesforce/vscode-i18n';
import { messages as enMessages } from './i18n';

export const nls = createNls({ instanceName: 'salesforcedx-lwc-language-server', messages: enMessages });
