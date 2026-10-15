/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createNls } from '@salesforce/vscode-i18n';
import * as vscode from 'vscode';
import { isOrgExtensionInstalled } from '../services/orgExtension';
import { messages as enMessages } from './i18n';
import { messages as jaMessages } from './i18n.ja';

export const nls = createNls({
  instanceName: 'salesforcedx-vscode-soql',
  messages: enMessages,
  jaMessages,
  locale: vscode.env.language
});

export const noDefaultOrgMessage = (): string =>
  nls.localize(isOrgExtensionInstalled() ? 'info_no_default_org' : 'info_no_default_org_without_org_extension');
