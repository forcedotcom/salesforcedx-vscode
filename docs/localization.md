## Introduction

There are two places where we need to localize: the package.json and the .ts
files.

### package.json

At a high-level, you want to prepare a package.nls.json that will contain all
the localize text in English. Then, for each other language that you want to
localize for, create a corresponding package.nls.{locale_code}.json, where
locale_code matches what is at
https://code.visualstudio.com/docs/getstarted/locales

Here is a more concrete example:

#### [Before] package.json

```json
  "contributes": {
    "commands": [
      {
        "command": "extension.sayHello",
        "title": "Hello"
      }
    ]
```

#### [After] package.json

```json
  "contributes": {
    "commands": [
      {
        "command": "extension.sayHello",
        "title": "%extension.sayHello.title%"
      }
    ]
```

### [New] new package.nls.json

```json
{
    "extension.sayHello.title": "Hello",
}
```

### [New] new package.nls.ja.json

```json
{
    "extension.sayHello.title": "こんにちは",
}
```

## TypeScript Files

1. Create a messages folder.
2. Create an index.ts file in there with the following contents. Yes, we could
   write some tool that does this but for now, just copy the contents into the
   folder.

```typescript
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
  loadMessageBundle(process.env.VSCODE_NLS_CONFIG ? JSON.parse(process.env.VSCODE_NLS_CONFIG!) : undefined)
);

```

3. In the same folder (this is important), create files that follow the
   following naming convention i18n.ts for the default English locale, and
   i18n.{locale_code}.ts for the localized files. locale_code should match what
   is at https://code.visualstudio.com/docs/getstarted/locales.

#### i18n.ts
```typescript
export const messages = {
  key_1: 'Hello',
  key_2: 'Bye',
  key_3_with_args: 'Hello %s'
};
```

#### i18n.ja.ts
```typescript
export const messages = {
  key_1: 'こんにちは',
  key_2: 'さようなら';
  key_3_with_args: 'こんにちは %sさん'
};
```

4. And when you want to use it, you would do something like the following.

```typescript
import { nls } from '../../src/messages';

nls.localize('some_key');
```

5. You can have as many folders as you want for localization. Just ensure that
   you copy the loader snippet to each one. It's customary to put all of them in
   one folder for smaller extensions though.

6. To test your localization changes, you _cannot_ just launch VS Code in
   development mode. You need to package up a .vsix, install that .vsix and be
   sure to follow the instructions at
   https://code.visualstudio.com/docs/getstarted/locales#_configure-language-command
   to configure your language. For CJK languages, I have found that using the
   `code . --locale=ja` to not work as well as using the command palette to
   configure the language.

