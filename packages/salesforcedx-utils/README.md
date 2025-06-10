# `salesforcedx-utils`

This is a internal module to the VSCode Extensions for Salesforce that is used for
sharing functionality across the VSCode Salesforce Extension code base when there
is not a dependancy on the vscode module. This is necessary due to needing the abilty
to test our code that doesn't use the vscode module without having to worry about it
not existing outside of the VSCode runtime.

## Message Type Safety

This package provides a comprehensive type-safe localization system that automatically infers argument types from printf-style format specifiers in message templates.

### Core Features

- **Compile-time validation**: TypeScript catches mismatched argument types at build time
- **IntelliSense support**: Full autocompletion and type hints for message arguments
- **Format specifier support**: All Node.js `util.format()` specifiers (`%s`, `%d`, `%i`, `%f`, `%j`, `%%`)
- **Zero runtime cost**: Type safety with no performance impact
- **Backward compatible**: Works seamlessly with existing localization code

### Type System Components

#### MessageArgs Type

Automatically infers argument types from message format specifiers:

```typescript
import { MessageArgs } from '@salesforce/salesforcedx-utils';

// Message with format specifiers
const messages = {
  user_stats: 'User %s has %d points and data %j',
  simple_message: 'Task %s completed'
} as const;

type MessageKey = keyof typeof messages;

// Type-safe localize function
const localize = <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof messages>): string => {
  // Implementation
};
```

### Usage Examples

#### ✅ Correct Usage

```typescript
// Single string parameter (%s)
localize('simple_message', 'deployment'); // ✅ string

// Mixed parameter types
localize('user_stats', 'John', 150, { role: 'admin' }); // ✅ string, number, any
```

#### ❌ TypeScript Compilation Errors

```typescript
// Wrong argument type
localize('simple_message', 123); // ❌ Error: Expected string, got number

// Missing arguments
localize('user_stats', 'John'); // ❌ Error: Expected 3 arguments, got 1

// Extra arguments
localize('simple_message', 'task', 'extra'); // ❌ Error: Too many arguments
```

### Format Specifier Support

| Specifier | TypeScript Type | Description     | Example                            |
| --------- | --------------- | --------------- | ---------------------------------- |
| `%s`      | `string`        | String          | `localize('msg', 'text')`          |
| `%d`      | `number`        | Decimal number  | `localize('msg', 42)`              |
| `%i`      | `number`        | Integer         | `localize('msg', 100)`             |
| `%f`      | `number`        | Float           | `localize('msg', 3.14)`            |
| `%j`      | `any`           | JSON object     | `localize('msg', {data: 'value'})` |
| `%%`      | (no argument)   | Literal percent | No argument consumed               |

### Implementation Pattern

1. **Define typed messages**:

```typescript
export const messages = {
  error_with_code: 'Error %s occurred with code %d',
  success_message: 'Operation %s completed successfully'
} as const;

export type MessageKey = keyof typeof messages;
```

2. **Create type-safe localize function**:

```typescript
import { MessageArgs } from '@salesforce/salesforcedx-utils';

export const nls = {
  localize: <K extends MessageKey>(key: K, ...args: MessageArgs<K, typeof messages>): string =>
    localizationService.localize(key, ...args)
};
```

3. **Use with full type safety**:

```typescript
// TypeScript enforces correct argument types
nls.localize('error_with_code', 'Connection timeout', 500); // ✅
nls.localize('success_message', 'deployment'); // ✅
```

### Benefits

- **Developer Experience**: Immediate feedback on incorrect usage
- **Refactoring Safety**: Changing message formats automatically updates type requirements
- **Runtime Safety**: Prevents common formatting errors before they reach production
- **Multi-language Support**: Type safety works across all localizations
- **IDE Integration**: Full IntelliSense support in VS Code and other TypeScript-aware editors

### Testing

The type system includes comprehensive tests covering:

- All format specifiers (`%s`, `%d`, `%i`, `%f`, `%j`)
- Mixed format specifier combinations
- Literal percent signs (`%%`) edge cases
- Partial argument population scenarios
- Node.js `util.format()` behavior validation
