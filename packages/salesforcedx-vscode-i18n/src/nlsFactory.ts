/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LOCALE_JA } from './constants';
import { parseNlsLocale } from './envLocale';
import { LocalizationConfig, LocalizationService } from './i18n/advancedLocalization';
import { MessageArgs } from './types/localization/messageArgs';
import { MessageBundle } from './types/localization/messageBundle';

export type Nls<T extends MessageBundle> = {
  localize: <K extends keyof T & string>(key: K, ...args: MessageArgs<K, T>) => string;
};

type CreateNlsOptions<T extends MessageBundle> = {
  instanceName: string;
  messages: T;
  jaMessages?: MessageBundle;
  /** Display language from `vscode.env.language` (web host). Unsupported values fall back to env/base. */
  locale?: string;
};

/** Creates a typed nls object for localization, registering base and optional Japanese translations */
export const createNls = <const T extends MessageBundle>({
  instanceName,
  messages,
  jaMessages,
  locale
}: CreateNlsOptions<T>): Nls<T> => {
  // Node (desktop host + spawned LSP) reads VSCODE_NLS_CONFIG; web collapses this branch and tree-shakes the env read.
  const fromEnv = process.env.ESBUILD_PLATFORM !== 'web' ? parseNlsLocale(process.env.VSCODE_NLS_CONFIG) : undefined;
  const config = LocalizationConfig.getInstance();
  const validatedLocale = config.isLocaleSupported(locale) ? locale : undefined;
  const resolved = validatedLocale ?? fromEnv;
  const service = LocalizationService.getInstance(instanceName, resolved);

  service.messageBundleManager.registerMessageBundle(instanceName, {
    messages: { ...messages },
    type: 'base'
  });

  if (jaMessages) {
    service.messageBundleManager.registerMessageBundle(instanceName, {
      messages: jaMessages,
      type: 'locale',
      locale: LOCALE_JA
    });
  }

  return {
    localize: <K extends keyof T & string>(key: K, ...args: MessageArgs<K, T>): string => service.localize(key, ...args)
  };
};
