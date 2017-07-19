import {
  BASE_FILE_EXTENSION,
  BASE_FILE_NAME,
  Config,
  DEFAULT_LOCALE,
  Localization,
  Message
} from '@salesforce/salesforcedx-utils-vscode/out/src/i18n';

function loadMessageBundle(config?: Config): Message {
  function resolveFileName(locale: string): string {
    return locale === DEFAULT_LOCALE
      ? `${BASE_FILE_NAME}.${BASE_FILE_EXTENSION}`
      : `${BASE_FILE_NAME}.${locale}.${BASE_FILE_EXTENSION}`;
  }

  const base = new Message(
    require(`./${resolveFileName(DEFAULT_LOCALE)}`).messages
  );

  if (config && config.locale && config.locale !== DEFAULT_LOCALE) {
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
    return base;
  }
}

export const nls = new Localization(
  loadMessageBundle(JSON.parse(process.env.VSCODE_NLS_CONFIG))
);
