/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Types
export { Locale } from './types/localization/config';
export { MessageArgs } from './types/localization/messageArgs';
export { MessageBundle } from './types/localization/messageBundle';
export { AdvancedMessageBundle } from './types/localization/advancedTypes';
export { LocalizationProvider } from './types/localization/localizationProvider';
export { Config } from './types/localization/config';

// i18n
export { LocalizationService, LocalizationConfig, MessageBundleManager } from './i18n/advancedLocalization';
export { Localization } from './i18n/localization';
export { Message } from './i18n/message';

// Constants
export { DEFAULT_LOCALE, LOCALE_JA, MISSING_LABEL_MSG } from './constants';

// Factory
export { createNls, Nls } from './nlsFactory';
