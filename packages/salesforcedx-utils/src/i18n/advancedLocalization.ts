/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DEFAULT_LOCALE } from '../constants';
import { AdvancedMessageBundle, Config, Locale } from '../types';
import { Localization } from './localization';
import { Message } from './message';

/* eslint-disable @typescript-eslint/consistent-type-assertions */

const SUPPORTED_LOCALES: Locale[] = [DEFAULT_LOCALE, 'ja'] as const;

/**
 * Type guard function to check if a value is a valid Locale
 * @param value - The value to check
 * @returns true if the value is a valid Locale, false otherwise
 */
const isLocale = (value: unknown): value is Locale => {
  if (typeof value !== 'string') {
    return false;
  }
  return SUPPORTED_LOCALES.includes(value as Locale);
};

/** export only for test */
export class LocalizationConfig {
  private static instance: LocalizationConfig | undefined;

  private constructor() {}

  public static getInstance(): LocalizationConfig {
    LocalizationConfig.instance ??= new LocalizationConfig();
    return LocalizationConfig.instance;
  }

  public isLocaleSupported(locale: unknown): boolean {
    return isLocale(locale);
  }

  public getDefaultLocale(): Locale {
    return DEFAULT_LOCALE;
  }
}

/** exported only for test */
export class MessageBundleManager {
  private static instances = new Map<string, MessageBundleManager>();
  private baseMessages: Message | null = null;
  private localeMessages = new Map<Locale, Message>();
  private messageBundles = new Map<string, AdvancedMessageBundle[]>();

  private constructor() {}

  public static getInstance(instanceName: string): MessageBundleManager {
    const instance = MessageBundleManager.instances.get(instanceName);
    if (!instance) {
      const newInstance = new MessageBundleManager();
      MessageBundleManager.instances.set(instanceName, newInstance);
      return newInstance;
    }
    return instance;
  }

  public registerMessageBundle(instanceName: string, bundle: AdvancedMessageBundle): void {
    if (!this.messageBundles.has(instanceName)) {
      this.messageBundles.set(instanceName, []);
    }
    const bundles = this.messageBundles.get(instanceName);
    if (bundles) {
      bundles.push(bundle);
      this.rebuildMessages(instanceName);
      // Refresh any LocalizationService instances that might be using this bundle manager
      const localizationService = LocalizationService.instances.get(instanceName);
      if (localizationService) {
        localizationService.refreshLocalization();
      }
    }
  }

  private rebuildMessages(instanceName: string): void {
    const bundles = this.messageBundles.get(instanceName) || [];
    const baseBundle = bundles.find(b => b.type === 'base');
    const localeBundles = bundles.filter(b => b.type === 'locale');

    if (baseBundle) {
      this.baseMessages = new Message(baseBundle.messages);
      localeBundles.forEach(localeBundle => {
        const messageLocale = localeBundle.messages['_locale'];
        const locale = localeBundle.locale || (this.isValidLocale(messageLocale) ? messageLocale : DEFAULT_LOCALE);
        if (this.isValidLocale(locale)) {
          this.localeMessages.set(locale, new Message(localeBundle.messages, this.baseMessages!));
        }
      });
    }
  }

  private isValidLocale(locale: string): locale is Locale {
    if (typeof locale !== 'string') {
      return false;
    }
    return SUPPORTED_LOCALES.includes(locale as Locale);
  }

  public loadMessageBundle(config?: Config): Message {
    if (!this.baseMessages) {
      throw new Error('No base messages registered');
    }

    const localeConfig = config?.locale || DEFAULT_LOCALE;
    const configManager = LocalizationConfig.getInstance();

    if (!configManager.isLocaleSupported(localeConfig)) {
      console.error(`Cannot find ${localeConfig}, defaulting to ${DEFAULT_LOCALE}`);
      return this.baseMessages;
    }

    return this.localeMessages.get(localeConfig) || this.baseMessages;
  }
}

export class LocalizationService {
  public static instances = new Map<string, LocalizationService>();
  private _nls: Localization | null = null;
  public readonly messageBundleManager: MessageBundleManager;
  private readonly instanceName: string;

  private constructor(instanceName: string) {
    this.instanceName = instanceName;
    this.messageBundleManager = MessageBundleManager.getInstance(instanceName);
  }

  public static getInstance(instanceName: string): LocalizationService {
    const instance = LocalizationService.instances.get(instanceName);
    if (!instance) {
      const newInstance = new LocalizationService(instanceName);
      LocalizationService.instances.set(instanceName, newInstance);
      return newInstance;
    }
    return instance;
  }

  public get nls(): Localization {
    if (!this._nls) {
      try {
        const message = this.messageBundleManager.loadMessageBundle();
        this._nls = new Localization(message);
      } catch {
        console.warn(
          `LocalizationService: No messages registered for instance '${this.instanceName}', using fallback localization`
        );
        const emptyMessage = new Message({});
        this._nls = new Localization(emptyMessage);
      }
    }
    return this._nls;
  }

  public localize<K extends string>(key: K, ...args: any[]): string {
    return this.nls.localize(key, ...args);
  }

  public refreshLocalization(): void {
    this._nls = null;
  }
}
