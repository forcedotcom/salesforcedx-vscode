# TerminalService

`executable` + `args` as argv (never a shell string). Desktop-only — `TerminalServiceError` on web.

Spawn: `@effect/platform` `Command.make` + `commandExecutor.start`. Tests stub `CommandExecutor.CommandExecutor`, not a ChildProcess service.

- `TerminalService.Default` deps: Config+Settings. CommandExecutor from the platform layer
- desktop: `servicesLayers` `import()`s `CrossSpawnCommandExecutorLive` inside the `ESBUILD_PLATFORM` node branch (LWC testSupport / visualforce javascriptMode). Module static-imports `cross-spawn` for Windows `.cmd`; `shell` never enabled. stdout/stderr via `NodeStream.fromReadable`
- web: `TerminalServiceWebLive` (noop CommandExecutor). `simpleExec` → `TerminalServiceError` (`errorType: unsupported_platform`) before start

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
- `timeout` optional `Duration.DurationInput` (default `Duration.seconds(30)`); larger Duration for long-running commands (e.g. org delete)
- `env` optional — overlays child env
- `cwd` optional — child working directory (omitted → extension-host `process.cwd()`)
- `executable === 'sf'` gets env assembled at exec time, lowest precedence first:
  - `SF_LOG_LEVEL` from `salesforcedx-vscode-core.SF_LOG_LEVEL` (default `fatal`)
  - `NODE_EXTRA_CA_CERTS` from `salesforcedx-vscode-core.NODE_EXTRA_CA_CERTS`, else ambient env var; omitted when neither
  - `SF_DISABLE_TELEMETRY=true` when telemetry opted out (`telemetry.telemetryLevel: off`, `salesforcedx-vscode-core.telemetry.enabled: false`, or CLI `disable-telemetry`)
  - `SF_JSON_TO_STDOUT=true` + `FORCE_COLOR=0` + `SFDX_TOOL='salesforce-vscode-extensions'`
  - caller `env` wins
- settings read per exec — don't thread these yourself
- stdout/stderr drain cap 100MB/stream. Overflow → `errorType: unknown`, `message` `Command failed (ERR_CHILD_PROCESS_STDIO_MAXBUFFER)`. Node `exec` maxBuffer is 1MB; retrieve-scale CLI stdout exceeds it. Spawn has none
- span `TerminalService.simpleExec`: never executable or args. Desktop: timeout / cwd-set / exit / bytes / `error.type` / `envKeys` (keys only). Web: `error.type: unsupported_platform` only (no spawn → no timeout/cwd)

## `TerminalServiceError`

`Schema.TaggedError`. Callers use `message`.

- `message` — diagnostic from exit / stdout / stderr. No invocation.
- `errorType` — required: `nonzero_exit` | `spawn_error` | `timeout` | `unknown` (100MB stdio cap) | `unsupported_platform` (web)
- `exitCode` — optional (`nonzero_exit`)
- `stdoutBytes` / `stderrBytes` — required; `0` when no output captured

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
