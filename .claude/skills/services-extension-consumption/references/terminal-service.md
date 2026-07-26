# TerminalService

Runs shell commands and parses stdout. Desktop-only — fails with `TerminalServiceError` on web.

## `simpleExec`

```typescript
simpleExec(args: {
  command: string;
  parse?: (stdout: string) => string;
  timeout?: Duration.DurationInput;
  env?: Record<string, string>;
  cwd?: string;
}): Effect<string, TerminalServiceError>
```

- single object param
- `parse` optional — omit to get trimmed stdout as `string`
- stdout trimmed before `parse` is called
- `timeout` optional `Duration.DurationInput` (default 30 s); pass a larger Duration for long-running commands (e.g. org delete)
- `env` optional — overrides/augments child process environment (merged over `process.env`)
- `cwd` optional — sets child working directory (omitted → uses extension-host process.cwd())
- `sf ` commands auto-inject `SF_JSON_TO_STDOUT=true` + `FORCE_COLOR=0` + `SFDX_TOOL='salesforce-vscode-extensions'` (caller `env` overrides win)
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
  return yield* terminal.simpleExec({ command: 'sf --version', parse: stdout => stdout.split(' ')[0] });
});
// version: string
```

Pass a longer `timeout` for slow commands:

```typescript
import * as Duration from 'effect/Duration';

const result = yield* Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminal = yield* api.services.TerminalService;

  return yield* terminal.simpleExec({ command: 'sf org delete scratch', timeout: Duration.minutes(2) });
});
// result: string
```
