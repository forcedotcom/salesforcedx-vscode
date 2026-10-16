/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalizationConfig, LocalizationService, MessageBundleManager } from '../../src/i18n/advancedLocalization';
import { createNls } from '../../src/nlsFactory';

const enMessages = { welcome: 'Welcome' };
const jaMessages = { _locale: 'ja', welcome: 'いらっしゃいませ' };

describe('createNls locale resolution', () => {
  const originalNlsConfig = process.env.VSCODE_NLS_CONFIG;

  beforeEach(() => {
    (LocalizationService as any).instances.clear();
    (MessageBundleManager as any).instances.clear();
    (LocalizationConfig as any).instance = undefined;
    delete process.env.VSCODE_NLS_CONFIG;
  });

  afterEach(() => {
    if (originalNlsConfig === undefined) {
      delete process.env.VSCODE_NLS_CONFIG;
    } else {
      process.env.VSCODE_NLS_CONFIG = originalNlsConfig;
    }
  });

  it('serves JA when locale param is ja', () => {
    const nls = createNls({ instanceName: 'param-ja', messages: enMessages, jaMessages, locale: 'ja' });
    expect(nls.localize('welcome')).toBe('いらっしゃいませ');
  });

  it('serves base when locale param is unsupported and no env', () => {
    const nls = createNls({ instanceName: 'param-de', messages: enMessages, jaMessages, locale: 'de' });
    expect(nls.localize('welcome')).toBe('Welcome');
  });

  it('serves base when no locale param and no env', () => {
    const nls = createNls({ instanceName: 'no-locale', messages: enMessages, jaMessages });
    expect(nls.localize('welcome')).toBe('Welcome');
  });

  it('resolves JA from VSCODE_NLS_CONFIG env when no param (node path)', () => {
    process.env.VSCODE_NLS_CONFIG = JSON.stringify({ locale: 'ja' });
    const nls = createNls({ instanceName: 'env-ja', messages: enMessages, jaMessages });
    expect(nls.localize('welcome')).toBe('いらっしゃいませ');
  });

  it('locale param wins over env', () => {
    process.env.VSCODE_NLS_CONFIG = JSON.stringify({ locale: 'ja' });
    const nls = createNls({ instanceName: 'param-over-env', messages: enMessages, jaMessages, locale: 'en' });
    expect(nls.localize('welcome')).toBe('Welcome');
  });
});
