/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Command from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';
import { type PlatformError } from '@effect/platform/Error';
import * as Arr from 'effect/Array';
import * as Config from 'effect/Config';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Layer from 'effect/Layer';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isNotUndefined, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { isNonEmpty, trim } from 'effect/String';
import { SFDX_CORE_SECTION } from '../constants';
import { ConfigService } from '../core/configService';
import { SettingsService } from '../vscode/settingsService';

export class TerminalServiceError extends Schema.TaggedError<TerminalServiceError>()('TerminalServiceError', {
  message: Schema.String,
  errorType: Schema.Literal('nonzero_exit', 'spawn_error', 'timeout', 'unknown', 'unsupported_platform'),
  exitCode: Schema.optional(Schema.Number),
  stdoutBytes: Schema.Number,
  stderrBytes: Schema.Number
}) {}

/** 100MB drain cap. Node exec maxBuffer is 1MB (`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`); retrieve-scale stdout exceeds it. Spawn has none. */
const MAX_BUFFER = 100 * 1024 * 1024;

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const execError = ({
  message,
  errorType,
  exitCode,
  stdoutBytes = 0,
  stderrBytes = 0
}: Pick<TerminalServiceError, 'message' | 'errorType'> &
  Partial<Pick<TerminalServiceError, 'exitCode' | 'stdoutBytes' | 'stderrBytes'>>) =>
  new TerminalServiceError({ message, errorType, exitCode, stdoutBytes, stderrBytes });

const nonEmptyTrimmed = (value: string | undefined) =>
  Option.fromNullable(value).pipe(Option.map(trim), Option.filter(isNonEmpty));

const commandFailed = ({
  identifier,
  stdout,
  stderr
}: {
  identifier?: string | number;
  stdout?: string;
  stderr?: string;
}): string =>
  pipe(
    Arr.getSomes([
      Option.some(isUndefined(identifier) ? 'Command failed' : `Command failed (${identifier})`),
      nonEmptyTrimmed(stderr),
      nonEmptyTrimmed(stdout)
    ]),
    Arr.join('\n')
  );

const platformToExecFailure = Match.type<PlatformError>().pipe(
  Match.tag('SystemError', err =>
    execError({ errorType: 'spawn_error', message: commandFailed({ identifier: err.reason }) })
  ),
  Match.tag('BadArgument', () =>
    execError({ errorType: 'spawn_error', message: commandFailed({ identifier: 'BadArgument' }) })
  ),
  Match.exhaustive
);

const collectUtf8 = (stream: Stream.Stream<Uint8Array, PlatformError>) =>
  stream.pipe(
    Stream.mapAccumEffect(0, (size, chunk) => {
      const next = size + chunk.byteLength;
      return next > MAX_BUFFER
        ? execError({
            errorType: 'unknown',
            message: 'Command failed (ERR_CHILD_PROCESS_STDIO_MAXBUFFER)',
            stdoutBytes: next
          })
        : Effect.succeed([next, chunk] as const);
    }),
    Stream.decodeText(),
    Stream.mkString
  );

/** Log at debug and succeed with `fallback`. Settings/config/workspace misses must not fail a CLI command. */
const fallbackTo =
  <A>(fallback: A) =>
  (error: unknown) =>
    Effect.logDebug(error).pipe(Effect.as(fallback));

type SimpleExecInput<A> = {
  executable: string;
  args: readonly string[];
  parse: (stdout: string) => A;
  timeout?: Duration.DurationInput;
  env?: Record<string, string>;
  cwd?: string;
};

const unsupportedOnWeb = Effect.fn('TerminalService.simpleExec')(function* <A>(_: SimpleExecInput<A>) {
  yield* Effect.annotateCurrentSpan({ 'error.type': 'unsupported_platform' });
  return yield* execError({ errorType: 'unsupported_platform', message: 'Not available on web' });
});

export class TerminalService extends Effect.Service<TerminalService>()('TerminalService', {
  accessors: false,
  dependencies: [ConfigService.Default, SettingsService.Default],
  effect: Effect.gen(function* () {
    const commandExecutor = yield* CommandExecutor.CommandExecutor;
    const configService = yield* ConfigService;
    const settingsService = yield* SettingsService;

    /** NODE_EXTRA_CA_CERTS omitted when unset — empty value breaks node's TLS bootstrap. */
    const sfCliSettingsEnv = Effect.fn('TerminalService.sfCliSettingsEnv')(
      function* () {
        const logLevel =
          (yield* settingsService.getValue<string>(SFDX_CORE_SECTION, 'SF_LOG_LEVEL', 'fatal')) ?? 'fatal';
        const caCerts =
          (yield* settingsService.getValue<string>(SFDX_CORE_SECTION, 'NODE_EXTRA_CA_CERTS')) ??
          Option.getOrUndefined(yield* Config.string('NODE_EXTRA_CA_CERTS').pipe(Config.option));
        const result: Record<string, string> = {
          SF_LOG_LEVEL: logLevel,
          ...(caCerts ? { NODE_EXTRA_CA_CERTS: caCerts } : {})
        };
        return result;
      },
      Effect.catchTags({
        MissingSettingsError: fallbackTo<Record<string, string>>({}),
        ConfigError: fallbackTo<Record<string, string>>({})
      })
    );

    /** Keep in sync with utils-vscode `isTelemetryExtensionConfigurationEnabled` (same two settings, negated). */
    const isVscodeTelemetryOff = Effect.fn('TerminalService.isVscodeTelemetryOff')(
      function* () {
        const level = yield* settingsService.getValue<string>('telemetry', 'telemetryLevel', 'all');
        const coreEnabled = yield* settingsService.getValue<boolean>(SFDX_CORE_SECTION, 'telemetry.enabled', true);
        return level === 'off' || coreEnabled === false;
      },
      Effect.catchTag('MissingSettingsError', fallbackTo(false))
    );

    const isTelemetryDisabled = Effect.fn('TerminalService.isTelemetryDisabled')(
      function* () {
        return (yield* isVscodeTelemetryOff()) ? true : yield* configService.isCliTelemetryDisabled();
      },
      Effect.catchTags({
        FailedToCreateConfigAggregatorError: fallbackTo(false),
        NoWorkspaceOpenError: fallbackTo(false)
      })
    );

    /**
     * Run `executable` + `args` as an argv vector (never a shell string). Desktop-only.
     * `sf` gets SF_LOG_LEVEL, optional NODE_EXTRA_CA_CERTS / SF_DISABLE_TELEMETRY, then
     * SF_JSON_TO_STDOUT / FORCE_COLOR=0 / SFDX_TOOL; caller `env` wins.
     */
    const simpleExec = Effect.fn('TerminalService.simpleExec')(function* <A>({
      executable,
      args,
      parse,
      timeout = Duration.seconds(30),
      env,
      cwd
    }: SimpleExecInput<A>) {
      const timeoutMs = Duration.toMillis(timeout);
      yield* Effect.annotateCurrentSpan({
        'terminal.timeout.ms': timeoutMs,
        'terminal.cwd.set': isNotUndefined(cwd)
      });
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
      if (isNotUndefined(mergedEnv)) yield* Effect.annotateCurrentSpan('envKeys', Object.keys(mergedEnv));
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const proc = yield* pipe(
            Command.make(executable, ...args),
            cmd => (isUndefined(mergedEnv) ? cmd : Command.env(mergedEnv)(cmd)),
            cmd => (isUndefined(cwd) ? cmd : Command.workingDirectory(cwd)(cmd)),
            commandExecutor.start
          );
          const [stdout, stderr, code] = yield* Effect.all(
            [collectUtf8(proc.stdout), collectUtf8(proc.stderr), proc.exitCode],
            { concurrency: 3 }
          );
          return code === 0
            ? { stdout, stderr }
            : yield* execError({
                errorType: 'nonzero_exit',
                message: commandFailed({ identifier: code, stdout, stderr }),
                exitCode: code,
                stdoutBytes: byteLength(stdout),
                stderrBytes: byteLength(stderr)
              });
        })
      ).pipe(
        Effect.catchTags({
          SystemError: platformToExecFailure,
          BadArgument: platformToExecFailure
        }),
        Effect.timeoutFail({
          duration: timeout,
          onTimeout: () => execError({ errorType: 'timeout', message: 'Command failed' })
        }),
        Effect.tap(execution =>
          Effect.annotateCurrentSpan({
            'process.exit.code': 0,
            'terminal.stdout.bytes': byteLength(execution.stdout),
            'terminal.stderr.bytes': byteLength(execution.stderr)
          })
        ),
        Effect.tapErrorTag('TerminalServiceError', failure =>
          Effect.annotateCurrentSpan({
            ...(isUndefined(failure.exitCode) ? {} : { 'process.exit.code': failure.exitCode }),
            'error.type': failure.errorType,
            'terminal.stdout.bytes': failure.stdoutBytes,
            'terminal.stderr.bytes': failure.stderrBytes
          })
        ),
        Effect.map(({ stdout }) => parse(stdout.trim()))
      );
    });
    return { simpleExec };
  })
}) {}

export const TerminalServiceWebLive = Layer.succeed(
  TerminalService,
  TerminalService.make({ simpleExec: unsupportedOnWeb })
);
