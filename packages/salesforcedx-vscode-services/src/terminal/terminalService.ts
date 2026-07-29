/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Config from 'effect/Config';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isError, isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { SFDX_CORE_SECTION } from '../constants';
import { ConfigService } from '../core/configService';
import { SettingsService } from '../vscode/settingsService';
import { ChildProcess } from './childProcess';

export class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String,
  command: Schema.String
}) {}

/** node's `exec` rejection (ExecException) carries `.stdout`/`.stderr`. Its `.message` already appends
 * stderr, but never stdout — `sf --json` puts its error payload on stdout, so fold any stdout not already
 * present into the message so failure-inspecting callers see the full output. */
const hasStringStdout = (e: Error): e is Error & { stdout: string } => 'stdout' in e && isString(e.stdout);

const execErrorMessage = (e: unknown): string => {
  if (!isError(e)) return 'exec failed';
  const trimmedStdout = hasStringStdout(e) ? e.stdout.trim() : '';
  return trimmedStdout && !e.message.includes(trimmedStdout) ? `${e.message}\n${trimmedStdout}` : e.message;
};

/** Nothing about assembling the CLI env may fail a CLI command: log the cause at debug and fall back. */
const safeDefault = <A>(fallback: A) =>
  Effect.catchAllCause((cause: Cause.Cause<unknown>) => Effect.logDebug(cause).pipe(Effect.as(fallback)));

export class TerminalService extends Effect.Service<TerminalService>()('TerminalService', {
  accessors: false,
  dependencies: [ChildProcess.Default, ConfigService.Default, SettingsService.Default],
  effect: Effect.gen(function* () {
    const childProcess = yield* ChildProcess;
    const configService = yield* ConfigService;
    const settingsService = yield* SettingsService;

    /** The two CLI-env settings, read fresh on every exec so changing one takes effect on the next command
     * with no window reload. NODE_EXTRA_CA_CERTS falls back to the ambient env var and is omitted entirely
     * when neither is set (its manifest default is null, and an empty value breaks node's TLS bootstrap).
     * A settings read must never fail a CLI command, so any failure folds to "no extra env". */
    const sfCliSettingsEnv = Effect.fn('TerminalService.sfCliSettingsEnv')(function* () {
      // the default arg handles an unset value; the `??` only narrows getValue's `T | undefined` return
      const logLevel = (yield* settingsService.getValue<string>(SFDX_CORE_SECTION, 'SF_LOG_LEVEL', 'fatal')) ?? 'fatal';
      const caCerts =
        (yield* settingsService.getValue<string>(SFDX_CORE_SECTION, 'NODE_EXTRA_CA_CERTS')) ??
        Option.getOrUndefined(yield* Config.string('NODE_EXTRA_CA_CERTS').pipe(Config.option));
      const result: Record<string, string> = {
        SF_LOG_LEVEL: logLevel,
        ...(caCerts ? { NODE_EXTRA_CA_CERTS: caCerts } : {})
      };
      return result;
    }, safeDefault<Record<string, string>>({}));

    /** VS Code's telemetry switches: the editor-wide `telemetry.telemetryLevel` and the Salesforce-specific
     * `salesforcedx-vscode-core.telemetry.enabled`. Either one off means off. A settings read must never fail
     * a CLI command.
     * Duplicated by necessity: vscode-services cannot depend on utils-vscode, so keep this in sync with
     * utils-vscode/src/services/telemetry.ts `isTelemetryExtensionConfigurationEnabled` (same two settings,
     * negated spelling). */
    const isVscodeTelemetryOff = Effect.fn('TerminalService.isVscodeTelemetryOff')(function* () {
      const level = yield* settingsService.getValue<string>('telemetry', 'telemetryLevel', 'all');
      const coreEnabled = yield* settingsService.getValue<boolean>(SFDX_CORE_SECTION, 'telemetry.enabled', true);
      return level === 'off' || coreEnabled === false;
    }, safeDefault(false));

    /** Whether to hand the CLI an SF_DISABLE_TELEMETRY opt-out. VS Code's own switches win outright, which
     * also skips the sf-config read; otherwise the CLI's `disable-telemetry` config decides. A telemetry
     * opt-out lookup (no workspace open, aggregator create/reload defect) must never fail a CLI command, so
     * any failure folds to "telemetry allowed" — same as the legacy isCLITelemetryAllowed catch. */
    const isTelemetryDisabled = Effect.fn('TerminalService.isTelemetryDisabled')(function* () {
      return (yield* isVscodeTelemetryOff()) ? true : yield* configService.isCliTelemetryDisabled();
    }, safeDefault(false));

    /** Execute a shell command and parse its stdout. Desktop-only; fails with TerminalServiceError on web. stdout is trimmed before parsing.
     * `timeout` (default 30s) bounds the child process; pass a larger Duration for long-running commands (e.g. org delete).
     * `env` overrides/augments the child's environment (merged over `process.env` in childProcess).
     * `cwd` sets the child's working directory (omitted → node uses the extension-host process.cwd()); needed for
     * cwd-dependent flows like project-local `config set`/`project generate`/relative-manifest retrieves.
     * `sf ` commands get an env assembled at exec time, lowest precedence first: `SF_LOG_LEVEL` +
     * `NODE_EXTRA_CA_CERTS` from settings, `SF_DISABLE_TELEMETRY` when telemetry is opted out, then
     * `SF_JSON_TO_STDOUT=true` + `FORCE_COLOR=0` + `SFDX_TOOL`; the caller's `env` merges over all of it, so an
     * explicit override always wins. Every sf consumer therefore gets clean, color-free JSON stdout attributed
     * to these extensions, plus the user's CLI env, without repeating any of it. */
    const simpleExec = Effect.fn('TerminalService.simpleExec')(function* <A>({
      command,
      parse,
      timeout = Duration.millis(30_000),
      env,
      cwd
    }: {
      command: string;
      parse: (stdout: string) => A;
      timeout?: Duration.DurationInput;
      env?: Record<string, string>;
      cwd?: string;
    }) {
      yield* Effect.annotateCurrentSpan('command', command);
      // fail fast before any settings/config work: none of it is available (or wanted) on web
      if (process.env.ESBUILD_PLATFORM === 'web') {
        return yield* new TerminalServiceError({ message: 'Not available on web', command });
      }
      // FORCE_COLOR=0 strips the ANSI escapes sf wraps JSON in (else JSON.parse breaks); SF_JSON_TO_STDOUT keeps
      // the payload on stdout; SFDX_TOOL is read by @salesforce/plugin-telemetry to attribute the invocation to
      // these extensions (same literal as TELEMETRY_HEADER, which the legacy cliCommandExecutor sets).
      // SF_DISABLE_TELEMETRY is injected only when telemetry is opted out, so re-enabling it mid-session works.
      // Caller env merges on top so an explicit override still wins.
      const sfEnv = command.startsWith('sf ')
        ? {
            ...(yield* sfCliSettingsEnv()),
            ...((yield* isTelemetryDisabled()) ? { SF_DISABLE_TELEMETRY: 'true' } : {}),
            SF_JSON_TO_STDOUT: 'true',
            FORCE_COLOR: '0',
            SFDX_TOOL: 'salesforce-vscode-extensions'
          }
        : undefined;
      const mergedEnv = sfEnv || env ? { ...sfEnv, ...env } : undefined;
      // annotate which env keys were set (keys only — never values, to avoid leaking secrets)
      if (mergedEnv) yield* Effect.annotateCurrentSpan('envKeys', Object.keys(mergedEnv));
      const result = yield* Effect.tryPromise({
        // signal is the runtime AbortSignal; threading it into exec lets a fiber interrupt kill the child
        try: signal => childProcess.exec(command, { timeout: Duration.toMillis(timeout), signal, env: mergedEnv, cwd }),
        // node's exec rejection appends stderr to `.message` but NOT stdout. `sf --json` writes its
        // structured error payload to stdout (SF_JSON_TO_STDOUT), so fold stdout in too — else callers
        // inspecting the failure (e.g. port-conflict detection) never see the JSON error text.
        catch: e => new TerminalServiceError({ message: execErrorMessage(e), command })
      });
      return parse(result.stdout.trim());
    });
    return { simpleExec };
  })
}) {}
