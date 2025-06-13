/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AdvancedMessageBundle, Config, Locale, MessageBundle } from '../../../src/types';

describe('Localization Types Unit Tests', () => {
  describe('Locale Type', () => {
    it('should accept valid locale values', () => {
      const enLocale: Locale = 'en';
      const jaLocale: Locale = 'ja';

      expect(enLocale).toBe('en');
      expect(jaLocale).toBe('ja');
    });
  });

  describe('Config Type', () => {
    it('should create valid config objects', () => {
      const enConfig: Config = { locale: 'en' };
      const jaConfig: Config = { locale: 'ja' };

      expect(enConfig.locale).toBe('en');
      expect(jaConfig.locale).toBe('ja');
    });
  });

  describe('MessageBundle Type', () => {
    it('should create valid message bundle objects', () => {
      const messageBundle: MessageBundle = {
        hello: 'Hello',
        goodbye: 'Goodbye',
        greeting: 'Hello %s'
      };

      expect(messageBundle.hello).toBe('Hello');
      expect(messageBundle.goodbye).toBe('Goodbye');
      expect(messageBundle.greeting).toBe('Hello %s');
    });

    it('should allow empty message bundles', () => {
      const emptyBundle: MessageBundle = {};
      expect(Object.keys(emptyBundle)).toHaveLength(0);
    });
  });

  describe('AdvancedMessageBundle Type', () => {
    it('should create valid base message bundles', () => {
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          'app.title': 'My Application',
          'error.generic': 'An error occurred'
        }
      };

      expect(baseBundle.type).toBe('base');
      expect(baseBundle.messages['app.title']).toBe('My Application');
      expect(baseBundle.locale).toBeUndefined();
    });

    it('should create valid locale message bundles with explicit locale', () => {
      const localeBundle: AdvancedMessageBundle = {
        type: 'locale',
        locale: 'ja',
        messages: {
          _locale: 'ja',
          'app.title': 'マイアプリケーション',
          'error.generic': 'エラーが発生しました'
        }
      };

      expect(localeBundle.type).toBe('locale');
      expect(localeBundle.locale).toBe('ja');
      expect(localeBundle.messages['_locale']).toBe('ja');
      expect(localeBundle.messages['app.title']).toBe('マイアプリケーション');
    });

    it('should create valid locale message bundles without explicit locale', () => {
      const localeBundle: AdvancedMessageBundle = {
        type: 'locale',
        messages: {
          _locale: 'ja',
          'app.title': 'マイアプリケーション'
        }
      };

      expect(localeBundle.type).toBe('locale');
      expect(localeBundle.locale).toBeUndefined();
      expect(localeBundle.messages['_locale']).toBe('ja');
    });

    it('should handle empty message bundles', () => {
      const emptyBaseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {}
      };

      const emptyLocaleBundle: AdvancedMessageBundle = {
        type: 'locale',
        locale: 'en',
        messages: {}
      };

      expect(emptyBaseBundle.type).toBe('base');
      expect(Object.keys(emptyBaseBundle.messages)).toHaveLength(0);
      expect(emptyLocaleBundle.type).toBe('locale');
      expect(Object.keys(emptyLocaleBundle.messages)).toHaveLength(0);
    });
  });

  describe('Type Compatibility', () => {
    it('should allow MessageBundle to be used in AdvancedMessageBundle', () => {
      const simpleBundle: MessageBundle = {
        key1: 'value1',
        key2: 'value2'
      };

      const advancedBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: simpleBundle
      };

      expect(advancedBundle.messages).toBe(simpleBundle);
    });

    it('should handle complex message structures', () => {
      const complexBundle: AdvancedMessageBundle = {
        type: 'locale',
        locale: 'ja',
        messages: {
          _locale: 'ja',
          'nested.key.deep': 'Deep nested value',
          'format.string': 'Hello %s, you have %d messages',
          'boolean.key': 'true',
          'number.key': '42',
          'special.chars': 'Special chars: !@#$%^&*()',
          'unicode.chars': '日本語のテキスト',
          'empty.value': ''
        }
      };

      expect(complexBundle.messages['nested.key.deep']).toBe('Deep nested value');
      expect(complexBundle.messages['format.string']).toBe('Hello %s, you have %d messages');
      expect(complexBundle.messages['unicode.chars']).toBe('日本語のテキスト');
      expect(complexBundle.messages['empty.value']).toBe('');
    });
  });
});
