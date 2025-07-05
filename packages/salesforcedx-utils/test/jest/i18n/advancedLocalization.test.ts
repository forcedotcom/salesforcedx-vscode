/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DEFAULT_LOCALE } from '../../../src/constants';
import { LocalizationService, LocalizationConfig, MessageBundleManager } from '../../../src/i18n/advancedLocalization';
import { AdvancedMessageBundle } from '../../../src/types';

describe('Advanced Localization Unit Tests', () => {
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Clear all singletons before each test
    (LocalizationService as any).instances.clear();
    (MessageBundleManager as any).instances.clear();
    (LocalizationConfig as any).instance = undefined;

    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('LocalizationConfig', () => {
    it('should create a singleton instance', () => {
      const config1 = LocalizationConfig.getInstance();
      const config2 = LocalizationConfig.getInstance();
      expect(config1).toBe(config2);
    });

    it('should recognize supported locales', () => {
      const config = LocalizationConfig.getInstance();
      expect(config.isLocaleSupported('en')).toBe(true);
      expect(config.isLocaleSupported('ja')).toBe(true);
      expect(config.isLocaleSupported('fr')).toBe(false);
      expect(config.isLocaleSupported('es')).toBe(false);
    });

    it('should handle non-string locale values', () => {
      const config = LocalizationConfig.getInstance();
      expect(config.isLocaleSupported(null)).toBe(false);
      expect(config.isLocaleSupported(undefined)).toBe(false);
      expect(config.isLocaleSupported(123)).toBe(false);
      expect(config.isLocaleSupported({})).toBe(false);
    });

    it('should return the default locale', () => {
      const config = LocalizationConfig.getInstance();
      expect(config.getDefaultLocale()).toBe(DEFAULT_LOCALE);
    });
  });

  describe('MessageBundleManager', () => {
    it('should create separate instances for different instance names', () => {
      const manager1 = MessageBundleManager.getInstance('test1');
      const manager2 = MessageBundleManager.getInstance('test2');
      expect(manager1).not.toBe(manager2);
    });

    it('should return the same instance for the same instance name', () => {
      const manager1 = MessageBundleManager.getInstance('test');
      const manager2 = MessageBundleManager.getInstance('test');
      expect(manager1).toBe(manager2);
    });

    it('should register and load base message bundles', () => {
      const manager = MessageBundleManager.getInstance('test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          hello: 'Hello',
          goodbye: 'Goodbye'
        }
      };

      manager.registerMessageBundle('test', baseBundle);
      const message = manager.loadMessageBundle();

      expect(message.localize('hello')).toBe('Hello');
      expect(message.localize('goodbye')).toBe('Goodbye');
    });

    it('should handle locale-specific message bundles', () => {
      const manager = MessageBundleManager.getInstance('test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          hello: 'Hello',
          goodbye: 'Goodbye'
        }
      };

      const jaBundle: AdvancedMessageBundle = {
        type: 'locale',
        locale: 'ja',
        messages: {
          _locale: 'ja',
          hello: 'こんにちは',
          goodbye: 'さようなら'
        }
      };

      manager.registerMessageBundle('test', baseBundle);
      manager.registerMessageBundle('test', jaBundle);

      const enMessage = manager.loadMessageBundle({ locale: 'en' });
      const jaMessage = manager.loadMessageBundle({ locale: 'ja' });

      expect(enMessage.localize('hello')).toBe('Hello');
      expect(jaMessage.localize('hello')).toBe('こんにちは');
    });

    it('should fall back to base messages for unsupported locales', () => {
      const manager = MessageBundleManager.getInstance('test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          hello: 'Hello'
        }
      };

      manager.registerMessageBundle('test', baseBundle);
      const message = manager.loadMessageBundle({ locale: 'fr' as any });

      expect(message.localize('hello')).toBe('Hello');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot find fr, defaulting to en'));
    });

    it('should fall back to locale from _locale key when locale property is not provided', () => {
      const manager = MessageBundleManager.getInstance('test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          hello: 'Hello'
        }
      };

      const jaBundle: AdvancedMessageBundle = {
        type: 'locale',
        messages: {
          _locale: 'ja',
          hello: 'こんにちは'
        }
      };

      manager.registerMessageBundle('test', baseBundle);
      manager.registerMessageBundle('test', jaBundle);

      const jaMessage = manager.loadMessageBundle({ locale: 'ja' });
      expect(jaMessage.localize('hello')).toBe('こんにちは');
    });

    it('should throw error when no base messages are registered', () => {
      const manager = MessageBundleManager.getInstance('test');
      expect(() => manager.loadMessageBundle()).toThrow('No base messages registered');
    });

    it('should handle multiple locale bundles', () => {
      const manager = MessageBundleManager.getInstance('test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          hello: 'Hello',
          world: 'World'
        }
      };

      const jaBundle: AdvancedMessageBundle = {
        type: 'locale',
        locale: 'ja',
        messages: {
          _locale: 'ja',
          hello: 'こんにちは'
        }
      };

      manager.registerMessageBundle('test', baseBundle);
      manager.registerMessageBundle('test', jaBundle);

      const jaMessage = manager.loadMessageBundle({ locale: 'ja' });
      // Should get Japanese for 'hello' and fall back to English for 'world'
      expect(jaMessage.localize('hello')).toBe('こんにちは');
      expect(jaMessage.localize('world')).toBe('World');
    });
  });

  describe('LocalizationService', () => {
    it('should create separate instances for different instance names', () => {
      const service1 = LocalizationService.getInstance('test1');
      const service2 = LocalizationService.getInstance('test2');
      expect(service1).not.toBe(service2);
    });

    it('should return the same instance for the same instance name', () => {
      const service1 = LocalizationService.getInstance('test');
      const service2 = LocalizationService.getInstance('test');
      expect(service1).toBe(service2);
    });

    it('should provide access to message bundle manager', () => {
      const service = LocalizationService.getInstance('test');
      expect(service.messageBundleManager).toBeInstanceOf(MessageBundleManager);
    });

    it('should localize messages after registering bundles', () => {
      const service = LocalizationService.getInstance('test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          greeting: 'Hello %s',
          farewell: 'Goodbye %s'
        }
      };

      service.messageBundleManager.registerMessageBundle('test', baseBundle);

      expect(service.localize('greeting', 'World')).toBe('Hello World');
      expect(service.localize('farewell', 'Friend')).toBe('Goodbye Friend');
    });

    it('should handle fallback localization when no messages are registered', () => {
      const service = LocalizationService.getInstance('test');
      const result = service.localize('nonexistent');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No messages registered for instance 'test'")
      );
      expect(result).toContain('!!! MISSING LABEL !!!');
    });

    it('should refresh localization when bundles are updated', () => {
      const service = LocalizationService.getInstance('test');
      const baseBundle1: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          message: 'Original Message'
        }
      };

      service.messageBundleManager.registerMessageBundle('test', baseBundle1);
      expect(service.localize('message')).toBe('Original Message');

      // Add a locale bundle to test refresh functionality
      const localeBundle: AdvancedMessageBundle = {
        type: 'locale',
        locale: 'ja',
        messages: {
          _locale: 'ja',
          message: 'Japanese Message'
        }
      };

      service.messageBundleManager.registerMessageBundle('test', localeBundle);

      // The service should still use the base message since it uses default locale
      expect(service.localize('message')).toBe('Original Message');

      // But we can verify the Japanese message is available through the bundle manager
      const jaMessage = service.messageBundleManager.loadMessageBundle({ locale: 'ja' });
      expect(jaMessage.localize('message')).toBe('Japanese Message');
    });

    it('should handle locale-specific localization', () => {
      const service = LocalizationService.getInstance('test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          welcome: 'Welcome'
        }
      };

      const jaBundle: AdvancedMessageBundle = {
        type: 'locale',
        locale: 'ja',
        messages: {
          _locale: 'ja',
          welcome: 'いらっしゃいませ'
        }
      };

      service.messageBundleManager.registerMessageBundle('test', baseBundle);
      service.messageBundleManager.registerMessageBundle('test', jaBundle);

      // The service uses the default locale, but we can test through the bundle manager
      const jaMessage = service.messageBundleManager.loadMessageBundle({ locale: 'ja' });
      expect(jaMessage.localize('welcome')).toBe('いらっしゃいませ');
    });

    it('should access nls property lazily', () => {
      const service = LocalizationService.getInstance('test');

      // First access should trigger lazy initialization
      const nls1 = service.nls;
      const nls2 = service.nls;

      expect(nls1).toBe(nls2); // Should be the same instance
    });

    it('should refresh localization and reinitialize nls', () => {
      const service = LocalizationService.getInstance('test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          test: 'Test Message'
        }
      };

      service.messageBundleManager.registerMessageBundle('test', baseBundle);

      const nls1 = service.nls;
      service.refreshLocalization();
      const nls2 = service.nls;

      // Should be different instances after refresh
      expect(nls1).not.toBe(nls2);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete localization workflow', () => {
      const service = LocalizationService.getInstance('integration-test');

      // Register base messages
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          'app.title': 'Salesforce Extensions',
          'error.generic': 'An error occurred: %s',
          'success.operation': 'Operation completed successfully'
        }
      };

      // Register Japanese messages
      const jaBundle: AdvancedMessageBundle = {
        type: 'locale',
        locale: 'ja',
        messages: {
          _locale: 'ja',
          'app.title': 'Salesforceエクステンション',
          'error.generic': 'エラーが発生しました: %s'
          // Note: 'success.operation' is not translated, should fall back to base
        }
      };

      service.messageBundleManager.registerMessageBundle('integration-test', baseBundle);
      service.messageBundleManager.registerMessageBundle('integration-test', jaBundle);

      // Test English localization
      const enMessage = service.messageBundleManager.loadMessageBundle({ locale: 'en' });
      expect(enMessage.localize('app.title')).toBe('Salesforce Extensions');
      expect(enMessage.localize('error.generic', 'Connection failed')).toBe('An error occurred: Connection failed');

      // Test Japanese localization
      const jaMessage = service.messageBundleManager.loadMessageBundle({ locale: 'ja' });
      expect(jaMessage.localize('app.title')).toBe('Salesforceエクステンション');
      expect(jaMessage.localize('error.generic', 'Connection failed')).toBe('エラーが発生しました: Connection failed');
      expect(jaMessage.localize('success.operation')).toBe('Operation completed successfully'); // Falls back to base
    });

    it('should handle message bundle manager and service interaction', () => {
      const service = LocalizationService.getInstance('interaction-test');
      const baseBundle: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          message: 'Hello World'
        }
      };

      // Register bundle through service's message bundle manager
      service.messageBundleManager.registerMessageBundle('interaction-test', baseBundle);

      // Should automatically refresh the service's localization
      expect(service.localize('message')).toBe('Hello World');
    });

    it('should handle multiple services with different bundles', () => {
      const service1 = LocalizationService.getInstance('service1');
      const service2 = LocalizationService.getInstance('service2');

      const bundle1: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          service: 'Service 1'
        }
      };

      const bundle2: AdvancedMessageBundle = {
        type: 'base',
        messages: {
          service: 'Service 2'
        }
      };

      service1.messageBundleManager.registerMessageBundle('service1', bundle1);
      service2.messageBundleManager.registerMessageBundle('service2', bundle2);

      expect(service1.localize('service')).toBe('Service 1');
      expect(service2.localize('service')).toBe('Service 2');
    });
  });
});
