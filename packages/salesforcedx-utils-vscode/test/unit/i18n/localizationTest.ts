/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Config, Localization, Message } from '../../../src/i18n';
import * as i18n from './i18n';
import * as i18nja from './i18n.ja';

/**
 * Due to the way `require` resolves the paths (relative to the module), we must
 * do the loading at the current localization point (i.e where all the .ts files
 * live).
 *
 * This snippet of code needs to be copied/generated to all localization points.
 */
function loadMessageBundle(config?: Config): Message {
  if (config && config.locale && config.locale === 'ja') {
    return new Message(i18nja.messages, new Message(i18n.messages));
  } else {
    return new Message(i18n.messages);
  }
}

describe('Localization tests', () => {
  it('Should handle default locale', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('key_1')).to.be.equals('Hello');
  });

  it('Should handle non-default locale', () => {
    const nls = new Localization(loadMessageBundle({ locale: 'ja' }));
    expect(nls.localize('key_1')).to.be.equals('こんにちは');
  });

  it('Should handle unfound locale and default to en', () => {
    const nls = new Localization(loadMessageBundle({ locale: 'de' }));
    expect(nls.localize('key_1')).to.be.equals('Hello');
  });

  it('Should handle fall-back to default locale if key is missing', () => {
    const nls = new Localization(loadMessageBundle({ locale: 'ja' }));
    expect(nls.localize('key_2')).to.be.equals('Bye');
  });

  it('Should not fail if a key is missing in default locale', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('non_existent_key')).to.be.equals(
      '!!! MISSING LABEL !!! non_existent_key'
    );
  });

  it('Should not error if arg counts do no match', () => {
    const nls = new Localization(loadMessageBundle());
    expect(() => nls.localize('key_3')).to.not.throw();
  });

  it('Should perform substitution in default locale if args >=1', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('key_3_with_args', 'John')).to.be.equals('Hello John');
  });

  it('Should perform substitution in locale if args >=1', () => {
    const nls = new Localization(loadMessageBundle({ locale: 'ja' }));
    expect(nls.localize('key_3_with_args', 'John')).to.be.equals(
      'こんにちは Johnさん'
    );
  });

  it('Should append args for missing label', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('non_existent_key', 'John')).to.be.equals(
      '!!! MISSING LABEL !!! non_existent_key (John)'
    );
  });
});
