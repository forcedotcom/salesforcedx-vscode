/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Command from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';
import { isPlatformError, type PlatformError } from '@effect/platform/Error';
import * as Cause from 'effect/Cause';
import * as Chunk from 'effect/Chunk';
import * as Config from 'effect/Config';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { SFDX_CORE_SECTION } from '../constants';
import { ConfigService } from '../core/configService';
import { SettingsService } from '../vscode/settingsService';
import { CrossSpawnCommandExecutorLive } from './crossSpawnCommandExecutor';

export class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String
}) {}

class SimpleExecFailure extends Schema.TaggedError<SimpleExecFailure>()('SimpleExecFailure', {
  message: Schema.String,
  errorType: Schema.Literal('nonzero_exit', 'spawn_error', 'timeout', 'unknown'),
  exitCode: Schema.optional(Schema.Number),
  signal: Schema.optional(Schema.String),
  stdoutBytes: Schema.Number,
  stderrBytes: Schema.Number
}) {}

/** node's exec `maxBuffer` default is 1MB; retrieve-scale CLI stdout exceeds it. */
const MAX_BUFFER = 100 * 1024 * 1024;

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const concatUtf8 = (chunks: readonly Uint8Array[]): string => {
  const size = chunks.reduce((n, chunk) => n + chunk.byteLength, 0);
  const out = new Uint8Array(size);
  chunks.reduce((offset, chunk) => {
    out.set(chunk, offset);
    return offset + chunk.byteLength;
  }, 0);
  return new TextDecoder().decode(out);
};

const commandFailed = (identifier: string | number | undefined, stdout: string, stderr: string): string =>
  [`Command failed${identifier === undefined ? '' : ` (${identifier})`}`, stderr.trim(), stdout.trim()]
    .filter(part => part.length > 0)
    .join('\n');

const platformToExecFailure = (err: PlatformError): SimpleExecFailure =>
  new SimpleExecFailure({
    errorType: 'spawn_error',
    message: commandFailed(err._tag === 'SystemError' ? err.reason : 'BadArgument', '', ''),
    stdoutBytes: 0,
    stderrBytes: 0
  });

const collectUtf8 = (stream: Stream.Stream<Uint8Array, PlatformError>) =>
  Stream.runFoldEffect(stream, { size: 0, chunks: Chunk.empty<Uint8Array>() }, (acc, chunk) => {
    const size = acc.size + chunk.byteLength;
    return size > MAX_BUFFER
      ? new SimpleExecFailure({
          errorType: 'unknown',
          message: 'Command failed (ERR_CHILD_PROCESS_STDIO_MAXBUFFER)',
          stdoutBytes: size,
          stderrBytes: 0
        })
      : Effect.succeed({ size, chunks: Chunk.append(acc.chunks, chunk) });
  }).pipe(
    Effect.map(acc => concatUtf8(acc.chunks.pipe(Chunk.toReadonlyArray))),
    Effect.mapError(err => (isPlatformError(err) ? platformToExecFailure(err) : err))
  );

const timeoutFailure = new SimpleExecFailure({
  errorType: 'timeout',
  message: 'Command failed',
  stdoutBytes: 0,
  stderrBytes: 0
});

/** Nothing about assembling the CLI env may fail a CLI command: log the cause at debug and fall back. */
const safeDefault = <A>(fallback: A) =>
  Effect.catchAllCause((cause: Cause.Cause<unknown>) => Effect.logDebug(cause).pipe(Effect.as(fallback)));

export class TerminalService extends Effect.Service<TerminalService>()('TerminalService', {
  accessors: false,
  dependencies: [CrossSpawnCommandExecutorLive, ConfigService.Default, SettingsService.Default],
  effect: Effect.gen(function* () {
    const commandExecutor = yield* CommandExecutor.CommandExecutor;
    const configService = yield* ConfigService;
    const settingsService = yield* SettingsService;

    /** NODE_EXTRA_CA_CERTS omitted when unset — empty value breaks node's TLS bootstrap. */
    const sfCliSettingsEnv = Effect.fn('TerminalService.sfCliSettingsEnv')(function* () {
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

    /** Keep in sync with utils-vscode `isTelemetryExtensionConfigurationEnabled` (same two settings, negated). */
    const isVscodeTelemetryOff = Effect.fn('TerminalService.isVscodeTelemetryOff')(function* () {
      const level = yield* settingsService.getValue<string>('telemetry', 'telemetryLevel', 'all');
      const coreEnabled = yield* settingsService.getValue<boolean>(SFDX_CORE_SECTION, 'telemetry.enabled', true);
      return level === 'off' || coreEnabled === false;
    }, safeDefault(false));

    const isTelemetryDisabled = Effect.fn('TerminalService.isTelemetryDisabled')(function* () {
      return (yield* isVscodeTelemetryOff()) ? true : yield* configService.isCliTelemetryDisabled();
    }, safeDefault(false));

    /**
     * Run `executable` + `args` as an argv vector (never a shell string). Desktop-only.
     * `sf` gets SF_LOG_LEVEL, optional NODE_EXTRA_CA_CERTS / SF_DISABLE_TELEMETRY, then
     * SF_JSON_TO_STDOUT / FORCE_COLOR=0 / SFDX_TOOL; caller `env` wins.
     */
    const simpleExec = Effect.fn('TerminalService.simpleExec')(function* <A>({
      executable,
      args,
      parse,
      timeout = Duration.millis(30_000),
      env,
      cwd
    }: {
      executable: string;
      args: readonly string[];
      parse: (stdout: string) => A;
      timeout?: Duration.DurationInput;
      env?: Record<string, string>;
      cwd?: string;
    }) {
      const timeoutMs = Duration.toMillis(timeout);
      yield* Effect.annotateCurrentSpan({
        'terminal.timeout.ms': timeoutMs,
        'terminal.cwd.set': cwd !== undefined
      });
      if (process.env.ESBUILD_PLATFORM === 'web') {
        yield* Effect.annotateCurrentSpan('error.type', 'unsupported_platform');
        return yield* new TerminalServiceError({ message: 'Not available on web' });
      }
      const sfEnv =
        executable === 'sf'
          ? {
              ...(yield* sfCliSettingsEnv()),
              ...((yield* isTelemetryDisabled()) ? { SF_DISABLE_TELEMETRY: 'true' } : {}),
              SF_JSON_TO_STDOUT: 'true',
              FORCE_COLOR: '0',
              SFDX_TOOL: 'salesforce-vscode-extensions'
            }
          : undefined;
      const mergedEnv = sfEnv || env ? { ...sfEnv, ...env } : undefined;
      if (mergedEnv) yield* Effect.annotateCurrentSpan('envKeys', Object.keys(mergedEnv));
      const cmd = Command.make(executable, ...args);
      const withEnv = mergedEnv === undefined ? cmd : Command.env(cmd, mergedEnv);
      const prepared = cwd === undefined ? withEnv : Command.workingDirectory(withEnv, cwd);
      const result = yield* Effect.scoped(
        Effect.gen(function* () {
          const proc = yield* Command.start(prepared).pipe(Effect.mapError(platformToExecFailure));
          const [stdout, stderr] = yield* Effect.all([collectUtf8(proc.stdout), collectUtf8(proc.stderr)], {
            concurrency: 2
          }).pipe(Effect.tapError(() => Effect.ignore(proc.kill())));
          const code = yield* proc.exitCode.pipe(Effect.mapError(platformToExecFailure));
          return code === 0
            ? { stdout, stderr }
            : yield* new SimpleExecFailure({
                errorType: 'nonzero_exit',
                message: commandFailed(code, stdout, stderr),
                exitCode: code,
                stdoutBytes: byteLength(stdout),
                stderrBytes: byteLength(stderr)
              });
        })
      ).pipe(
        Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor),
        Effect.timeoutFail({ duration: timeout, onTimeout: () => timeoutFailure }),
        Effect.tap(execution =>
          Effect.annotateCurrentSpan({
            'process.exit.code': 0,
            'terminal.stdout.bytes': byteLength(execution.stdout),
            'terminal.stderr.bytes': byteLength(execution.stderr)
          })
        ),
        Effect.tapError(failure =>
          Effect.annotateCurrentSpan({
            ...(failure.exitCode === undefined ? {} : { 'process.exit.code': failure.exitCode }),
            'error.type': failure.errorType,
            ...(failure.signal === undefined ? {} : { 'terminal.signal': failure.signal }),
            'terminal.stdout.bytes': failure.stdoutBytes,
            'terminal.stderr.bytes': failure.stderrBytes
          })
        ),
        Effect.mapError(failure => new TerminalServiceError({ message: failure.message }))
      );
      return parse(result.stdout.trim());
    });
    return { simpleExec };
  })
}) {}
