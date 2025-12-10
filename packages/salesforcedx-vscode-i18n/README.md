# @salesforce/vscode-i18n

Internationalization (i18n) library for Salesforce VS Code extensions.

## Overview

This package provides a comprehensive type-safe localization system for VS Code extensions, with automatic type inference for message arguments based on printf-style format specifiers.

## Installation

```bash
npm install @salesforce/vscode-i18n
```

## Features

- **Type-safe message localization**: Compile-time validation of message arguments
- **Multiple locale support**: Built-in support for English (en) and Japanese (ja)
- **Format specifier support**: Full support for Node.js `util.format()` specifiers (`%s`, `%d`, `%i`, `%f`, `%j`, `%%`)
- **Message bundle management**: Advanced localization service for managing multiple message bundles
- **Zero runtime cost**: Type safety with no performance impact

## Usage

### Basic Usage

```typescript
import { LocalizationService, MessageArgs } from '@salesforce/vscode-i18n';

// Define your message bundles
const enMessages = {
  greeting: 'Hello %s',
  userStats: 'User %s has %d points'
} as const;

const jaMessages = {
  greeting: 'こんにちは %s',
  userStats: 'ユーザー %s は %d ポイントを持っています'
} as const;

// Create a localization service instance
const service = LocalizationService.getInstance('my-extension');

// Register message bundles
service.messageBundleManager.registerMessageBundle('my-extension', {
  messages: enMessages,
  type: 'base'
});

service.messageBundleManager.registerMessageBundle('my-extension', {
  messages: { ...jaMessages, _locale: 'ja' },
  type: 'locale',
  locale: 'ja'
});

// Use type-safe localization
type MessageKey = keyof typeof enMessages;
const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof enMessages>): string =>
    service.localize(key, ...args)
};

// Type-safe calls with IntelliSense support
nls.localize('greeting', 'World'); // ✅ string
nls.localize('userStats', 'John', 150); // ✅ string, number
// nls.localize('greeting', 123); // ❌ Error: Expected string
```

### Type Safety

The package includes `MessageArgs` type that automatically infers argument types from format specifiers:

```typescript
import { MessageArgs } from '@salesforce/vscode-i18n';

const messages = {
  simple: 'Task %s completed',
  complex: 'User %s has %d points and data %j'
} as const;

type SimpleArgs = MessageArgs<'simple', typeof messages>; // [string]
type ComplexArgs = MessageArgs<'complex', typeof messages>; // [string, number, any]
```

## API

### LocalizationService

Singleton service for managing message bundles and localization.

```typescript
const service = LocalizationService.getInstance(instanceName: string);
```

### MessageBundleManager

Manages message bundles for different locales.

```typescript
service.messageBundleManager.registerMessageBundle(instanceName, {
  messages: messageBundle,
  type: 'base' | 'locale',
  locale?: Locale
});
```

### Constants

- `DEFAULT_LOCALE`: The default locale ('en')
- `LOCALE_JA`: Japanese locale constant ('ja')
- `MISSING_LABEL_MSG`: Error message for missing labels

## License

BSD-3-Clause

## Support

For issues or questions, please file an issue at:
https://github.com/forcedotcom/salesforcedx-vscode/issues
