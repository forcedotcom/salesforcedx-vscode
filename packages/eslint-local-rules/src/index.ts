/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { commandMustBeInPackageJson } from './commandMustBeInPackageJson';
import { noDuplicateI18nValues } from './noDuplicateI18nValues';

import { noVscodeMessageLiterals } from './noVscodeMessageLiterals';
import { packageJsonCommandRefs } from './packageJsonCommandRefs';
import { packageJsonI18nDescriptions } from './packageJsonI18nDescriptions';
import { packageJsonIconPaths } from './packageJsonIconPaths';
import { packageJsonViewRefs } from './packageJsonViewRefs';

const plugin = {
  rules: {
    'command-must-be-in-package-json': commandMustBeInPackageJson,
    'no-duplicate-i18n-values': noDuplicateI18nValues,
    'no-vscode-message-literals': noVscodeMessageLiterals,
    'package-json-i18n-descriptions': packageJsonI18nDescriptions,
    'package-json-icon-paths': packageJsonIconPaths,
    'package-json-command-refs': packageJsonCommandRefs,
    'package-json-view-refs': packageJsonViewRefs
  }
};
export = plugin;
