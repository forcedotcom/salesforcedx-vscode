import { expect } from 'chai';
import {
  BASE_FILE_EXTENSION,
  BASE_FILE_NAME,
  Config,
  DEFAULT_LOCALE,
  Localization,
  Message
} from '../../src/i18n/localization';

/**
 * Due to the way `require` resolves the paths (relative to the module), we must
 * do the loading at the current localization point (i.e where all the .ts files
 * live).
 *
 * This snippet of code needs to be copied/generated to all localization points.
 */
function loadMessageBundle(config?: Config): Message {
  function resolveFileName(locale: string): string {
    return locale === DEFAULT_LOCALE
      ? `${BASE_FILE_NAME}.${BASE_FILE_EXTENSION}`
      : `${BASE_FILE_NAME}.${locale}.${BASE_FILE_EXTENSION}`;
  }

  if (config && config.locale) {
    const base = new Message(
      require(`./${resolveFileName(DEFAULT_LOCALE)}`).messages
    );

    try {
      const layer = new Message(
        require(`./${resolveFileName(config.locale)}`).messages,
        base
      );
      return layer;
    } catch (e) {
      console.error(`Cannot find ${config.locale}, defaulting to en`);
      return base;
    }
  } else {
    const base = new Message(
      require(`./${resolveFileName(DEFAULT_LOCALE)}`).messages
    );
    return base;
  }
}

describe('Localization tests', () => {
  it('Should handle default locale', () => {
    const nls = new Localization(loadMessageBundle());
    expect(nls.localize('key_1')).to.be.equals('Hello');
  });

  it('Should handle non-default locale', () => {
    const nls = new Localization(loadMessageBundle({ locale: 'ja' }));
    expect(nls.localize('key_1')).to.be.equals('こんいちは');
  });

  it('Should handle unfound locale and default to en', () => {
    const nls = new Localization(loadMessageBundle({ locale: 'de' }));
    expect(nls.localize('key_1')).to.be.equals('Hello');
  });

  it('Should handle fall-back to default locale if key is missing', () => {
    const nls = new Localization(loadMessageBundle({ locale: 'ja' }));
    expect(nls.localize('key_2')).to.be.equals('Bye');
  });

  it('Should error if arg counts do no match', () => {
    const nls = new Localization(loadMessageBundle());
    expect(() => nls.localize('key_3')).to.throw();
  });
});
