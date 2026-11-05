/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConfigService,
  SettingsService,
  TerminalService,
  TerminalServiceError,
  type SimpleExecInput
} from '@salesforce/vscode-services/v2';
import * as Config from 'effect/Config';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import type * as PlatformError from 'effect/PlatformError';
import { isNotUndefined, isUndefined } from 'effect/Predicate';
import * as ChildProcess from 'effect/process/ChildProcess';
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner';
import * as Stream from 'effect/Stream';
import { runInterruptibleWorker } from './interruptibleWorker.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

/** 100MB per-stream cap, matching the existing spawn-based CLI execution contract. */
const MAX_BUFFER = 100 * 1024 * 1024;
const coreSection = 'salesforcedx-vscode-core';
const byteLength = (value: string) => new TextEncoder().encode(value).byteLength;
const execError = ({
  stdoutBytes = 0,
  stderrBytes = 0,
  ...fields
}: Pick<TerminalServiceError, 'message' | 'errorType'> &
  Partial<Pick<TerminalServiceError, 'exitCode' | 'stdoutBytes' | 'stderrBytes'>>) =>
  new TerminalServiceError({ ...fields, stdoutBytes, stderrBytes });
const commandFailed = (identifier: string | number, stdout = '', stderr = '') =>
  [
    `Command failed (${identifier})`,
    ...[stderr, stdout].map(value => value.trim()).filter(value => value.length > 0)
  ].join('\n');
const platformToExecFailure = (error: PlatformError.PlatformError) =>
  execError({
    errorType: 'spawn_error',
    message: commandFailed(error.reason._tag)
  });
const collectUtf8 = (stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>) =>
  stream.pipe(
    Stream.mapAccumEffect(
      () => 0,
      (size, chunk) => {
        const next = size + chunk.byteLength;
        return next > MAX_BUFFER
          ? execError({
              errorType: 'unknown',
              message: 'Command failed (ERR_CHILD_PROCESS_STDIO_MAXBUFFER)',
              stdoutBytes: next
            })
          : Effect.succeed([next, [chunk]] as const);
      }
    ),
    Stream.decodeText(),
    Stream.mkString
  );
/** Settings/config/workspace misses must not fail a CLI command. */
const fallbackTo =
  <A>(fallback: A) =>
  (error: unknown) =>
    Effect.logDebug(error).pipe(Effect.as(fallback));

export const TerminalServiceLayer = Layer.effect(
  TerminalService,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner;
    const config = yield* ConfigService;
    const settings = yield* SettingsService;
    const operations = yield* ServiceOperations;
    const sfCliSettingsEnv = Effect.fn('TerminalService.sfCliSettingsEnv')(
      function* () {
        const logLevel = yield* settings.getValueOrElse(coreSection, 'SF_LOG_LEVEL', 'fatal');
        const caCerts =
          (yield* settings.getValue<string>(coreSection, 'NODE_EXTRA_CA_CERTS')) ??
          Option.getOrUndefined(yield* Config.option(Config.String('NODE_EXTRA_CA_CERTS')));
        // NODE_EXTRA_CA_CERTS omitted when unset — empty value breaks Node's TLS bootstrap.
        return { SF_LOG_LEVEL: logLevel, ...(caCerts ? { NODE_EXTRA_CA_CERTS: caCerts } : {}) };
      },
      Effect.catchTags({
        MissingSettingsError: fallbackTo<Record<string, string>>({}),
        ConfigError: fallbackTo<Record<string, string>>({})
      })
    );
    const isVscodeTelemetryOff = Effect.fn('TerminalService.isVscodeTelemetryOff')(
      function* () {
        const level = yield* settings.getValueOrElse('telemetry', 'telemetryLevel', 'all');
        const enabled = yield* settings.getValueOrElse(coreSection, 'telemetry.enabled', true);
        return level === 'off' || !enabled;
      },
      Effect.catchTag('MissingSettingsError', fallbackTo(false))
    );
    const isTelemetryDisabled = Effect.fn('TerminalService.isTelemetryDisabled')(
      function* () {
        return (yield* isVscodeTelemetryOff()) ? true : yield* config.isCliTelemetryDisabled();
      },
      Effect.catchTags({
        FailedToCreateConfigAggregatorError: fallbackTo(false),
        NoWorkspaceOpenError: fallbackTo(false)
      })
    );
    const execute = Effect.fn('TerminalService.execute')(
      function* (
        executable: string,
        args: readonly string[],
        env: Record<string, string> | undefined,
        cwd: string | undefined
      ) {
        const proc = yield* spawner.spawn(ChildProcess.make(executable, args, { env, cwd, shell: false }));
        const [stdout, stderr, code] = yield* Effect.all(
          [collectUtf8(proc.stdout), collectUtf8(proc.stderr), proc.exitCode],
          { concurrency: 3 }
        );
        return code === 0
          ? { stdout, stderr }
          : yield* execError({
              errorType: 'nonzero_exit',
              message: commandFailed(code, stdout, stderr),
              exitCode: code,
              stdoutBytes: byteLength(stdout),
              stderrBytes: byteLength(stderr)
            });
      },
      Effect.scoped,
      Effect.catchTag('PlatformError', platformToExecFailure)
    );
    return TerminalService.of({
      /** Run an argv vector, never a shell string. Caller env wins over sf settings/defaults. */
      simpleExec: Effect.fn('TerminalService.simpleExec')(function* <A>({
        executable,
        args,
        parse,
        timeout = Duration.seconds(30),
        env,
        cwd
      }: SimpleExecInput<A>) {
        yield* Effect.annotateCurrentSpan({
          'terminal.timeout.ms': Duration.toMillis(timeout),
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
        // Racing the worker itself would discard its finalizer failures on timeout/interruption.
        return yield* runInterruptibleWorker(
          execute(executable, args, mergedEnv, cwd),
          Effect.sleep(timeout).pipe(Effect.andThen(execError({ errorType: 'timeout', message: 'Command failed' })))
        ).pipe(
          Effect.tap(result =>
            Effect.annotateCurrentSpan({
              'process.exit.code': 0,
              'terminal.stdout.bytes': byteLength(result.stdout),
              'terminal.stderr.bytes': byteLength(result.stderr)
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
      }, operations.run)
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));

export const TerminalServiceWebLayer = Layer.effect(
  TerminalService,
  Effect.gen(function* () {
    const operations = yield* ServiceOperations;
    return TerminalService.of({
      simpleExec: Effect.fn('TerminalService.simpleExec')(function* <A>(_: SimpleExecInput<A>) {
        yield* Effect.annotateCurrentSpan('error.type', 'unsupported_platform');
        return yield* execError({ errorType: 'unsupported_platform', message: 'Not available on web' });
      }, operations.run)
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));

// The web define removes this import and all native process code from browser bundles.
export const terminalPlatformLayer =
  process.env.ESBUILD_PLATFORM === 'web'
    ? TerminalServiceWebLayer
    : Layer.unwrap(
        Effect.promise(() => import('./crossSpawnChildProcessSpawner.js')).pipe(
          Effect.map(({ CrossSpawnChildProcessSpawnerLayer }) =>
            TerminalServiceLayer.pipe(Layer.provide(CrossSpawnChildProcessSpawnerLayer))
          )
        )
      );
