/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { commandMustBeInPackageJson } from './commandMustBeInPackageJson';
import { noDirectServicesImports } from './noDirectServicesImports';
import { noDuplicateI18nValues } from './noDuplicateI18nValues';
import { noDuplicatePlaywrightLocators } from './noDuplicatePlaywrightLocators';
import { noEffectFnWrapper } from './noEffectFnWrapper';
import { noEffectServiceAccessorCalls } from './noEffectServiceAccessorCalls';
import { noExplicitEffectReturnType } from './noExplicitEffectReturnType';
import { noUnusedI18nMessages } from './noUnusedI18nMessages';
import { noVscodeMessageLiterals } from './noVscodeMessageLiterals';
import { noVscodeProgressTitleLiterals } from './noVscodeProgressTitleLiterals';
import { noVscodeQuickpickDescriptionLiterals } from './noVscodeQuickpickDescriptionLiterals';
import { noVscodeUri } from './noVscodeUri';
import { noVscodeValidateInputLiterals } from './noVscodeValidateInputLiterals';
import { packageJsonCommandRefs } from './packageJsonCommandRefs';
import { packageJsonExtensionIcon } from './packageJsonExtensionIcon';
import { packageJsonI18nDescriptions } from './packageJsonI18nDescriptions';
import { packageJsonIconPaths } from './packageJsonIconPaths';
import { packageJsonSalesforceDepVersions } from './packageJsonSalesforceDepVersions';
import { packageJsonViewRefs } from './packageJsonViewRefs';
import { querybuilderHtmlI18nKeys } from './querybuilderHtmlI18nKeys';
import { requireEffectFnSpanName } from './requireEffectFnSpanName';
import { vscodeignoreContributesConflict } from './vscodeignoreContributesConflict';
import { vscodeignoreRequiredPatterns } from './vscodeignoreRequiredPatterns';
import { vscodeignoreTextProcessor } from './vscodeignoreTextProcessor';

const plugin = {
  processors: {
    vscodeignoreText: vscodeignoreTextProcessor
  },
  rules: {
    'command-must-be-in-package-json': commandMustBeInPackageJson,
    'no-duplicate-i18n-values': noDuplicateI18nValues,
    'no-duplicate-playwright-locators': noDuplicatePlaywrightLocators,
    'no-direct-services-imports': noDirectServicesImports,
    'no-effect-fn-wrapper': noEffectFnWrapper,
    'require-effect-fn-span-name': requireEffectFnSpanName,
    'no-effect-service-accessor-calls': noEffectServiceAccessorCalls,
    'no-explicit-effect-return-type': noExplicitEffectReturnType,
    'no-unused-i18n-messages': noUnusedI18nMessages,
    'querybuilder-html-i18n-keys': querybuilderHtmlI18nKeys,
    'no-vscode-message-literals': noVscodeMessageLiterals,
    'no-vscode-progress-title-literals': noVscodeProgressTitleLiterals,
    'no-vscode-quickpick-description-literals': noVscodeQuickpickDescriptionLiterals,
    'no-vscode-uri': noVscodeUri,
    'no-vscode-validateinput-literals': noVscodeValidateInputLiterals,
    'package-json-i18n-descriptions': packageJsonI18nDescriptions,
    'package-json-extension-icon': packageJsonExtensionIcon,
    'package-json-icon-paths': packageJsonIconPaths,
    'package-json-command-refs': packageJsonCommandRefs,
    'package-json-salesforce-dep-versions': packageJsonSalesforceDepVersions,
    'package-json-view-refs': packageJsonViewRefs,
    'vscodeignore-contributes-conflict': vscodeignoreContributesConflict,
    'vscodeignore-required-patterns': vscodeignoreRequiredPatterns
  }
};
export = plugin;
