/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalizationConfig } from './i18n/advancedLocalization';
import { Locale } from './types/localization/config';

/**
 * Parse a supported {@link Locale} from a VSCODE_NLS_CONFIG JSON string.
 * Returns undefined for malformed input, missing `.locale`, or unsupported locales. Never throws.
 */
export const parseNlsLocale = (raw?: string): Locale | undefined => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');
    const value =
      typeof parsed === 'object' && parsed !== undefined && parsed !== null && 'locale' in parsed
        ? parsed.locale
        : undefined;
    const lowered = typeof value === 'string' ? value.toLowerCase() : undefined;
    return LocalizationConfig.getInstance().isLocaleSupported(lowered) ? lowered : undefined;
  } catch {
    return undefined;
  }
};
