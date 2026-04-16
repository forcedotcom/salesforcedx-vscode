# TerminalService

Runs shell commands and parses stdout. Desktop-only — fails with `TerminalServiceError` on web.

## `simpleExec<A>`

```typescript
simpleExec(command: string, parse?: (stdout: string) => A): Effect<A, TerminalServiceError>
```

- `parse` optional — omit to get trimmed stdout as `string`
- stdout trimmed before `parse` is called
- 10 s timeout
- Traced with `TerminalService.simpleExec` span (`command` attribute)
- On web: immediate `TerminalServiceError` (no exec attempted)

## `TerminalServiceError`

`Schema.TaggedError`. Fields:

- `message` — error description
- `command` — the command that failed

## Usage

Parse stdout into a string:

```typescript
const version = yield* Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminal = yield* api.services.TerminalService;

  // stdout is pre-trimmed; split "7.200.6 @salesforce/cli/..." → just the version token
  return yield* terminal.simpleExec('sf --version', stdout => stdout.split(' ')[0]);
});
// version: string
```

Parse stdout into a typed value using the generic param `<A>`:

```typescript
type SfVersion = { major: number; minor: number; patch: number };

const parsed = yield* Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminal = yield* api.services.TerminalService;

  return yield* terminal.simpleExec<SfVersion>('sf --version', stdout => {
    const [major, minor, patch] = stdout.split('.').map(Number);
    return { major, minor, patch };
  });
});
// parsed: SfVersion
```
