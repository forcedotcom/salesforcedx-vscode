# TerminalService

Runs `executable` + `args` as an argv vector (never a shell string). Desktop-only — `TerminalServiceError` on web.

Spawn: `@effect/platform` `Command.make` / `Command.start` via `CrossSpawnCommandExecutorLive` (cross-spawn; `shell` never enabled). Tests stub `CommandExecutor.CommandExecutor`, not a ChildProcess service.

## `simpleExec`

```typescript
simpleExec(args: {
  executable: string;
  args: readonly string[];
  parse: (stdout: string) => A;
  timeout?: Duration.DurationInput;
  env?: Record<string, string>;
  cwd?: string;
}): Effect<A, TerminalServiceError>
```

- `parse` required — `identity` for trimmed stdout
- stdout trimmed before `parse`
- `timeout` optional `Duration.DurationInput` (default 30s); pass a larger Duration for long-running commands (e.g. org delete)
- `env` optional — overlays child env
- `cwd` optional — child working directory (omitted → extension-host `process.cwd()`)
- `executable === 'sf'` gets env assembled at exec time, lowest precedence first:
  - `SF_LOG_LEVEL` from `salesforcedx-vscode-core.SF_LOG_LEVEL` (default `fatal`)
  - `NODE_EXTRA_CA_CERTS` from `salesforcedx-vscode-core.NODE_EXTRA_CA_CERTS`, else ambient env var; omitted when neither
  - `SF_DISABLE_TELEMETRY=true` when telemetry opted out (`telemetry.telemetryLevel: off`, `salesforcedx-vscode-core.telemetry.enabled: false`, or CLI `disable-telemetry`)
  - `SF_JSON_TO_STDOUT=true` + `FORCE_COLOR=0` + `SFDX_TOOL='salesforce-vscode-extensions'`
  - caller `env` wins
- settings read per exec — don't thread these yourself
- span `TerminalService.simpleExec`: timeout / cwd-set / exit / bytes / `error.type` / `envKeys` (keys only). Never executable or args
- web: immediate `TerminalServiceError` (no spawn)

## `TerminalServiceError`

`Schema.TaggedError`. Fields:

- `message` — diagnostic from exit / stdout / stderr. No invocation.

## Usage

Parse stdout into a string:

```typescript
const version = yield* Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminal = yield* api.services.TerminalService;

  // stdout is pre-trimmed; split "7.200.6 @salesforce/cli/..." → just the version token
  return yield* terminal.simpleExec({
    executable: 'sf',
    args: ['--version'],
    parse: stdout => stdout.split(' ')[0]
  });
});
// version: string
```

Pass a longer `timeout` for slow commands:

```typescript
import * as Duration from 'effect/Duration';
import { identity } from 'effect/Function';

const result = yield* Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const terminal = yield* api.services.TerminalService;

  return yield* terminal.simpleExec({
    executable: 'sf',
    args: ['org', 'delete', 'scratch'],
    parse: identity,
    timeout: Duration.minutes(2)
  });
});
// result: string
```
