/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConfigService,
  FailedToCreateConfigAggregatorError,
  TerminalService,
  TerminalServiceError
} from '@salesforce/vscode-services/v2';
import * as Duration from 'effect/Duration';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as PlatformError from 'effect/PlatformError';
import type * as ChildProcess from 'effect/process/ChildProcess';
import * as ChildProcessSpawner from 'effect/process/ChildProcessSpawner';
import * as Sink from 'effect/Sink';
import * as Stream from 'effect/Stream';
import * as TestClock from 'effect/testing/TestClock';
import * as Tracer from 'effect/Tracer';
import * as vscode from 'vscode';
import { SettingsServiceLayer } from '../../../src/services/settingsService.js';
import { TerminalServiceLayer, TerminalServiceWebLayer } from '../../../src/services/terminalService.js';

const settings = new Map<string, unknown>();
let settingsFail = false;
const cliTelemetry = vi.fn<ConfigService['Service']['isCliTelemetryDisabled']>(() => Effect.succeed(false));
beforeEach(() => {
  settings.clear();
  settingsFail = false;
  cliTelemetry.mockReturnValue(Effect.succeed(false));
  vi.stubEnv('NODE_EXTRA_CA_CERTS', undefined);
  vi.spyOn(vscode.workspace, 'getConfiguration').mockImplementation(section => {
    if (settingsFail) throw new Error('settings unavailable');
    return { get: (key: string) => settings.get(`${section}.${key}`) } as vscode.WorkspaceConfiguration;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const encoder = new TextEncoder();
const bytes = (value = '') => Stream.succeed(encoder.encode(value));
const fixture = (
  options: {
    readonly stdout?: Stream.Stream<Uint8Array, PlatformError.PlatformError>;
    readonly stderr?: Stream.Stream<Uint8Array, PlatformError.PlatformError>;
    readonly exit?: Effect.Effect<ChildProcessSpawner.ExitCode, PlatformError.PlatformError>;
    readonly spawnError?: PlatformError.PlatformError;
    readonly cleanup?: Effect.Effect<void>;
  } = {}
) => {
  const acquired = Promise.withResolvers<void>();
  const closed = vi.fn();
  const commands: ChildProcess.Command[] = [];
  const stdout = options.stdout ?? bytes();
  const stderr = options.stderr ?? bytes();
  const spawn: ChildProcessSpawner.ChildProcessSpawner['Service']['spawn'] = command => {
    commands.push(command);
    return options.spawnError
      ? Effect.fail(options.spawnError)
      : Effect.acquireRelease(
          Effect.sync(() => {
            acquired.resolve();
            return ChildProcessSpawner.makeHandle({
              pid: ChildProcessSpawner.ProcessId(1),
              exitCode: options.exit ?? Effect.succeed(ChildProcessSpawner.ExitCode(0)),
              isRunning: Effect.succeed(true),
              kill: () => Effect.void,
              stdin: Sink.drain,
              stdout,
              stderr,
              all: Stream.merge(stdout, stderr),
              getInputFd: () => Sink.drain,
              getOutputFd: () => Stream.empty,
              unref: Effect.succeed(Effect.void)
            });
          }),
          () => (options.cleanup ?? Effect.void).pipe(Effect.andThen(Effect.sync(closed)))
        );
  };
  const runtime = ManagedRuntime.make(
    TerminalServiceLayer.pipe(
      Layer.provide(
        Layer.mergeAll(
          SettingsServiceLayer,
          Layer.mock(ConfigService, { isCliTelemetryDisabled: cliTelemetry }),
          Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, ChildProcessSpawner.make(spawn))
        )
      ),
      Layer.provideMerge(TestClock.layer()),
      Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromEnv()))
    )
  );
  return { runtime, acquired: acquired.promise, closed, commands };
};
const simple = { executable: 'sf', args: ['org', 'display'], parse: (stdout: string) => stdout } as const;

it('preserves argv/cwd, trims only before parsing, and keeps argument/env secrets off spans', async () => {
  const { runtime, commands, closed } = fixture({ stdout: bytes('  hello 👋\n'), stderr: bytes('warning') });
  const spans: Tracer.Span[] = [];
  const tracer = Tracer.make({
    span: options => {
      const span = Tracer.nativeTracer.span(options);
      spans.push(span);
      return span;
    }
  });
  const parse = vi.fn((value: string) => ({ value }));
  try {
    expect(
      await runtime.runPromise(
        TerminalService.use(service =>
          service.simpleExec({
            ...simple,
            args: ['--target-org', 'secret-user', '; echo unsafe'],
            cwd: '/project with spaces',
            env: { SECRET: 'secret-token' },
            parse
          })
        ).pipe(Effect.withTracer(tracer))
      )
    ).toEqual({ value: 'hello 👋' });
    expect(parse).toHaveBeenCalledExactlyOnceWith('hello 👋');
    expect(commands[0]).toMatchObject({
      _tag: 'StandardCommand',
      command: 'sf',
      args: ['--target-org', 'secret-user', '; echo unsafe'],
      options: { cwd: '/project with spaces', shell: false }
    });
    expect(closed).toHaveBeenCalledTimes(1);
    const attributes = spans.find(span => span.name === 'TerminalService.simpleExec')?.attributes;
    expect(attributes?.get('terminal.timeout.ms')).toBe(30_000);
    expect(attributes?.get('terminal.cwd.set')).toBe(true);
    expect(attributes?.get('terminal.stdout.bytes')).toBe(13);
    expect(attributes?.get('terminal.stderr.bytes')).toBe(7);
    expect(attributes?.get('envKeys')).toContain('SECRET');
    expect(JSON.stringify(spans.map(span => Object.fromEntries(span.attributes)))).not.toMatch(
      /secret-user|secret-token|echo unsafe|project with spaces/
    );
  } finally {
    await runtime.dispose();
  }
});

it.each([
  [{}, { SF_LOG_LEVEL: 'fatal' }],
  [{ 'salesforcedx-vscode-core.SF_LOG_LEVEL': 'debug' }, { SF_LOG_LEVEL: 'debug' }],
  [{ 'salesforcedx-vscode-core.NODE_EXTRA_CA_CERTS': '/setting.pem' }, { NODE_EXTRA_CA_CERTS: '/setting.pem' }],
  [{ 'telemetry.telemetryLevel': 'off' }, { SF_DISABLE_TELEMETRY: 'true' }],
  [{ 'salesforcedx-vscode-core.telemetry.enabled': false }, { SF_DISABLE_TELEMETRY: 'true' }]
] as const)('preserves sf setting defaults and precedence %#', async (values, expected) => {
  Object.entries(values).forEach(([key, value]) => settings.set(key, value));
  const { runtime, commands } = fixture();
  try {
    await runtime.runPromise(TerminalService.use(service => service.simpleExec(simple)));
    expect(commands[0]).toMatchObject({
      options: {
        env: { SF_JSON_TO_STDOUT: 'true', FORCE_COLOR: '0', SFDX_TOOL: 'salesforce-vscode-extensions', ...expected }
      }
    });
    if ('SF_DISABLE_TELEMETRY' in expected) expect(cliTelemetry).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});

it.each([undefined, '', '/ambient.pem'])('omits empty CA certs, otherwise uses ambient fallback: %s', async ca => {
  vi.stubEnv('NODE_EXTRA_CA_CERTS', ca);
  const { runtime, commands } = fixture();
  try {
    await runtime.runPromise(TerminalService.use(service => service.simpleExec(simple)));
    if (ca) expect(commands[0]).toMatchObject({ options: { env: { NODE_EXTRA_CA_CERTS: ca } } });
    else if (commands[0]?._tag === 'StandardCommand')
      expect(commands[0].options.env).not.toHaveProperty('NODE_EXTRA_CA_CERTS');
  } finally {
    await runtime.dispose();
  }
});

it('prefers configured certs and caller env over ambient values and every sf default', async () => {
  vi.stubEnv('NODE_EXTRA_CA_CERTS', '/ambient.pem');
  settings.set('salesforcedx-vscode-core.NODE_EXTRA_CA_CERTS', '/setting.pem');
  cliTelemetry.mockReturnValue(Effect.succeed(true));
  const { runtime, commands } = fixture();
  try {
    await runtime.runPromise(
      TerminalService.use(service =>
        service.simpleExec({
          ...simple,
          env: { FORCE_COLOR: '1', SF_LOG_LEVEL: 'trace', SF_DISABLE_TELEMETRY: 'false' }
        })
      )
    );
    expect(commands[0]).toMatchObject({
      options: {
        env: {
          SF_JSON_TO_STDOUT: 'true',
          SFDX_TOOL: 'salesforce-vscode-extensions',
          FORCE_COLOR: '1',
          SF_LOG_LEVEL: 'trace',
          SF_DISABLE_TELEMETRY: 'false',
          NODE_EXTRA_CA_CERTS: '/setting.pem'
        }
      }
    });
  } finally {
    await runtime.dispose();
  }
});

it('omits telemetry disablement when every switch allows it', async () => {
  const { runtime, commands } = fixture();
  try {
    await runtime.runPromise(TerminalService.use(service => service.simpleExec(simple)));
    if (commands[0]?._tag === 'StandardCommand')
      expect(commands[0].options.env).not.toHaveProperty('SF_DISABLE_TELEMETRY');
  } finally {
    await runtime.dispose();
  }
});

it.each(['settings', 'config'] as const)('still executes after a %s lookup failure', async failing => {
  settingsFail = failing === 'settings';
  if (failing === 'config')
    cliTelemetry.mockReturnValue(Effect.fail(new FailedToCreateConfigAggregatorError({ message: 'no workspace' })));
  const { runtime, commands } = fixture();
  try {
    expect(await runtime.runPromise(TerminalService.use(service => service.simpleExec(simple)))).toBe('');
    expect(commands[0]).toMatchObject({
      options: { env: { SF_JSON_TO_STDOUT: 'true', FORCE_COLOR: '0', SFDX_TOOL: 'salesforce-vscode-extensions' } }
    });
    if (commands[0]?._tag === 'StandardCommand')
      expect(commands[0].options.env).not.toHaveProperty('SF_DISABLE_TELEMETRY');
  } finally {
    await runtime.dispose();
  }
});

it.each([undefined, { EXTRA: 'value' }])(
  'passes non-sf commands without reading settings/config or injecting env',
  async env => {
    settingsFail = true;
    const { runtime, commands } = fixture();
    try {
      await runtime.runPromise(
        TerminalService.use(service => service.simpleExec({ ...simple, executable: 'echo', args: ['sf'], env }))
      );
      expect(commands[0]).toMatchObject({ command: 'echo', args: ['sf'], options: { env, cwd: undefined } });
      expect(cliTelemetry).not.toHaveBeenCalled();
    } finally {
      await runtime.dispose();
    }
  }
);

it('decodes UTF-8 split across chunks and drains stdout/stderr concurrently with exit', async () => {
  const done = Promise.withResolvers<void>();
  const utf8 = encoder.encode('€👍');
  const { runtime } = fixture({
    stdout: Stream.fromIterable([utf8.slice(0, 1), utf8.slice(1, 4), utf8.slice(4)]),
    stderr: Stream.fromEffect(
      Effect.sync(() => {
        done.resolve();
        return encoder.encode('stderr');
      })
    ),
    exit: Effect.promise(() => done.promise).pipe(Effect.as(ChildProcessSpawner.ExitCode(0)))
  });
  try {
    expect(await runtime.runPromise(TerminalService.use(service => service.simpleExec(simple)))).toBe('€👍');
  } finally {
    await runtime.dispose();
  }
});

it('drains retrieve-scale output beyond exec maxBuffer', async () => {
  const output = 'x'.repeat(2 * 1024 * 1024);
  const { runtime } = fixture({ stdout: bytes(output) });
  try {
    expect(
      await runtime.runPromise(
        TerminalService.use(service => service.simpleExec({ ...simple, parse: value => value.length }))
      )
    ).toBe(output.length);
  } finally {
    await runtime.dispose();
  }
});

it.each(['stdout', 'stderr'] as const)('enforces the existing 100MB %s cap and closes the process', async stream => {
  const chunk = new Uint8Array(1024 * 1024);
  const { runtime, closed } = fixture({ [stream]: Stream.fromIterable(Array.from({ length: 101 }, () => chunk)) });
  try {
    const failure = await runtime.runPromise(
      TerminalService.use(service => service.simpleExec(simple)).pipe(Effect.flip)
    );
    expect(failure).toMatchObject({
      _tag: 'TerminalServiceError',
      errorType: 'unknown',
      message: 'Command failed (ERR_CHILD_PROCESS_STDIO_MAXBUFFER)',
      stdoutBytes: 101 * chunk.length
    });
    expect(closed).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it('keeps nonzero stdout JSON, stderr, exit code and byte counts without invocation details', async () => {
  const output = '{"message":"port 1717 already in use"}';
  const { runtime, closed } = fixture({
    stdout: bytes(output),
    stderr: bytes(' warning\n'),
    exit: Effect.succeed(ChildProcessSpawner.ExitCode(1))
  });
  const parse = vi.fn();
  try {
    const failure = await runtime.runPromise(
      TerminalService.use(service => service.simpleExec({ ...simple, args: ['secret-user'], parse })).pipe(Effect.flip)
    );
    expect(failure).toBeInstanceOf(TerminalServiceError);
    expect(failure).toMatchObject({
      errorType: 'nonzero_exit',
      exitCode: 1,
      message: `Command failed (1)\nwarning\n${output}`,
      stdoutBytes: encoder.encode(output).length,
      stderrBytes: 9
    });
    expect(failure.message).not.toContain('secret-user');
    expect(parse).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledTimes(1);
  } finally {
    await runtime.dispose();
  }
});

it.each(['spawn', 'stdout', 'stderr', 'exit'] as const)(
  'maps a %s PlatformError without leaking executable or args',
  async stage => {
    const error = PlatformError.systemError({
      _tag: 'NotFound',
      module: 'ChildProcess',
      method: 'spawn',
      pathOrDescriptor: 'secret-executable',
      description: 'secret-user'
    });
    const { runtime, closed } = fixture({
      ...(stage === 'spawn' ? { spawnError: error } : {}),
      ...(stage === 'exit' ? { exit: Effect.fail(error) } : {}),
      ...(stage === 'stdout' || stage === 'stderr' ? { [stage]: Stream.fail(error) } : {})
    });
    try {
      const failure = await runtime.runPromise(
        TerminalService.use(service => service.simpleExec(simple)).pipe(Effect.flip)
      );
      expect(failure).toMatchObject({ errorType: 'spawn_error', message: 'Command failed (NotFound)' });
      expect(JSON.stringify(failure)).not.toMatch(/secret-executable|secret-user/);
      expect(closed).toHaveBeenCalledTimes(stage === 'spawn' ? 0 : 1);
    } finally {
      await runtime.dispose();
    }
  }
);

it('keeps parse callback exceptions as defects and closes before parsing', async () => {
  const defect = new Error('parse defect');
  const { runtime, closed } = fixture({ stdout: bytes('data') });
  try {
    const exit = await runtime.runPromiseExit(
      TerminalService.use(service =>
        service.simpleExec({
          ...simple,
          parse: () => {
            expect(closed).toHaveBeenCalledTimes(1);
            throw defect;
          }
        })
      )
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit))
      expect(exit.cause.reasons).toContainEqual(expect.objectContaining({ _tag: 'Die', defect }));
  } finally {
    await runtime.dispose();
  }
});

it.each(['cancel', 'dispose', 'timeout'] as const)(
  'waits for slow process cleanup after %s, rejects late calls, and never parses',
  async mode => {
    const finalizing = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const { runtime, acquired, commands, closed } = fixture({
      stdout: Stream.never,
      stderr: Stream.never,
      exit: Effect.never,
      cleanup: Effect.promise(() => {
        finalizing.resolve();
        return release.promise;
      })
    });
    const service = await runtime.runPromise(TerminalService);
    const parse = vi.fn();
    const controller = new AbortController();
    let returned = false;
    // Exercise external consumer calls as well as calls owned by the provider runtime.
    const operation = service.simpleExec({ ...simple, parse, timeout: Duration.seconds(1) });
    const running = (
      mode === 'dispose'
        ? Effect.runPromiseExit(operation, { signal: controller.signal })
        : runtime.runPromiseExit(operation, { signal: controller.signal })
    ).then(result => {
      returned = true;
      return result;
    });
    await acquired;
    const stopping =
      mode === 'dispose'
        ? runtime.dispose()
        : mode === 'timeout'
          ? runtime.runPromise(TestClock.adjust(Duration.seconds(1)))
          : Promise.resolve(controller.abort());
    try {
      await finalizing.promise;
      expect(returned).toBe(false);
      expect(closed).not.toHaveBeenCalled();
      expect(parse).not.toHaveBeenCalled();
      if (mode === 'dispose') {
        expect(Exit.isFailure(await Effect.runPromiseExit(service.simpleExec(simple)))).toBe(true);
        expect(commands).toHaveLength(1);
      }
    } finally {
      release.resolve();
      await stopping;
    }
    const exit = await running;
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit))
      expect(
        exit.cause.reasons.some(reason =>
          mode === 'timeout'
            ? reason._tag === 'Fail' && reason.error.errorType === 'timeout'
            : reason._tag === 'Interrupt'
        )
      ).toBe(true);
    expect(closed).toHaveBeenCalledTimes(1);
    await runtime.dispose();
  }
);

it('preserves a process cleanup defect during caller interruption', async () => {
  const defect = new Error('process cleanup defect');
  const { runtime, acquired } = fixture({
    stdout: Stream.never,
    stderr: Stream.never,
    exit: Effect.never,
    cleanup: Effect.die(defect)
  });
  const controller = new AbortController();
  const running = runtime.runPromiseExit(
    TerminalService.use(service => service.simpleExec(simple)),
    { signal: controller.signal }
  );
  await acquired;
  controller.abort();
  try {
    const exit = await running;
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
      expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
    }
  } finally {
    await runtime.dispose();
  }
});

it('fails on web without requesting settings, config or a process spawner', async () => {
  const runtime = ManagedRuntime.make(TerminalServiceWebLayer);
  try {
    expect(
      await runtime.runPromise(TerminalService.use(service => service.simpleExec(simple)).pipe(Effect.flip))
    ).toMatchObject({ errorType: 'unsupported_platform', message: 'Not available on web' });
    expect(cliTelemetry).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
  }
});
