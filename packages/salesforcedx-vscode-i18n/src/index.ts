/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Types
export type { Locale } from './types/localization/config';
export type { MessageArgs } from './types/localization/messageArgs';
export type { MessageBundle } from './types/localization/messageBundle';
export type { AdvancedMessageBundle } from './types/localization/advancedTypes';
export type { LocalizationProvider } from './types/localization/localizationProvider';
export type { Config } from './types/localization/config';

// i18n
export { LocalizationService, LocalizationConfig, MessageBundleManager } from './i18n/advancedLocalization';
export { Localization } from './i18n/localization';
export { Message } from './i18n/message';

// Constants
export { DEFAULT_LOCALE, LOCALE_JA, MISSING_LABEL_MSG } from './constants';

// Factory
export { createNls } from './nlsFactory';
export type { Nls } from './nlsFactory';
