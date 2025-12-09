/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { noDuplicateI18nValues } from './noDuplicateI18nValues';
import { noVscodeMessageLiterals } from './noVscodeMessageLiterals';

const plugin = {
  rules: {
    'no-duplicate-i18n-values': noDuplicateI18nValues,
    'no-vscode-message-literals': noVscodeMessageLiterals
  }
};

export = plugin;
