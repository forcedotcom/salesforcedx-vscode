/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LOCALE_JA } from './constants';
import { LocalizationService } from './i18n/advancedLocalization';
import { MessageArgs } from './types/localization/messageArgs';
import { MessageBundle } from './types/localization/messageBundle';

export type Nls<T extends MessageBundle> = {
  localize: <K extends keyof T & string>(key: K, ...args: MessageArgs<K, T>) => string;
};

type CreateNlsOptions<T extends MessageBundle> = {
  instanceName: string;
  messages: T;
  jaMessages?: MessageBundle;
};

/** Creates a typed nls object for localization, registering base and optional Japanese translations */
export const createNls = <const T extends MessageBundle>({
  instanceName,
  messages,
  jaMessages
}: CreateNlsOptions<T>): Nls<T> => {
  const service = LocalizationService.getInstance(instanceName);

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
