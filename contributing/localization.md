# Localization

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
  "extension.sayHello.title": "Hello"
}
```

### [New] new package.nls.ja.json

```json
{
  "extension.sayHello.title": "こんにちは"
}
```

## TypeScript Files

1. Create a messages folder.
2. Create an index.ts file using the `LocalizationService` pattern:

   ```typescript
   import { LOCALE_JA, LocalizationService, type MessageArgs } from '@salesforce/vscode-i18n';
   import { messages as enMessages, MessageKey } from './i18n';
   import { messages as jaMessages } from './i18n.ja';

   // Create a unique instance name for your extension
   const DEFAULT_INSTANCE = 'your-extension-name';

   // Get the localization service instance
   const localizationService = LocalizationService.getInstance(DEFAULT_INSTANCE);

   // Register the English (base) message bundle
   localizationService.messageBundleManager.registerMessageBundle(DEFAULT_INSTANCE, {
     messages: enMessages,
     type: 'base'
   });

   // Register the Japanese localized message bundle
   localizationService.messageBundleManager.registerMessageBundle(DEFAULT_INSTANCE, {
     messages: { ...jaMessages, _locale: LOCALE_JA },
     type: 'locale'
   });

   // Export a type-safe localize function
   export const nls = {
     localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof enMessages>): string =>
       localizationService.localize(key, ...args)
   };
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
   } as const;

   export type MessageKey = keyof typeof messages;
   ```

   #### i18n.ja.ts

   ```typescript
   import { MessageKey } from './i18n';

   export const messages: Record<MessageKey, string> = {
     key_1: 'こんにちは',
     key_2: 'さようなら',
     key_3_with_args: 'こんにちは %sさん'
   };
   ```

4. And when you want to use it, you would do something like the following.

   ```typescript
   import { nls } from '../../src/messages';

   // Type-safe localization with autocompletion
   nls.localize('key_1'); // Returns 'Hello'
   nls.localize('key_3_with_args', 'World'); // Returns 'Hello World'
   ```

   The `MessageArgs` type will automatically infer the correct argument types
   from format specifiers in your messages (%s for string, %d for number, etc.).

5. You can have as many message folders as you want for localization. Each
   extension should use a unique instance name when calling
   `LocalizationService.getInstance()`. It's customary to put all messages in
   one folder for smaller extensions.

6. To test your localization changes, you _cannot_ just launch VS Code in
   development mode. You need to package up a .vsix, install that .vsix and be
   sure to follow the instructions at
   https://code.visualstudio.com/docs/getstarted/locales#_configure-language-command
   to configure your language. For CJK languages, I have found that using the
   `code . --locale=ja` to not work as well as using the command palette to
   configure the language.
