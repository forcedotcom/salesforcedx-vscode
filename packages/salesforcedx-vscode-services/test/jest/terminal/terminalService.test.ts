/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Command from '@effect/platform/Command';
import * as CommandExecutor from '@effect/platform/CommandExecutor';
import { SystemError } from '@effect/platform/Error';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Inspectable from 'effect/Inspectable';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Sink from 'effect/Sink';
import * as Stream from 'effect/Stream';
import * as Tracer from 'effect/Tracer';
import { ConfigService, FailedToCreateConfigAggregatorError } from '../../../src/core/configService';
import { TerminalService, TerminalServiceError } from '../../../src/terminal/terminalService';
import { SettingsError, SettingsService } from '../../../src/vscode/settingsService';

const settings: { values: Record<string, unknown>; fail: boolean } = { values: {}, fail: false };
const cliTelemetry: { disabled: boolean; fail: boolean } = { disabled: false, fail: false };

const getValueMock = jest.fn();
const getValueImpl = (section: string, key: string, defaultValue?: unknown) =>
  settings.fail
    ? Effect.fail(new SettingsError({ cause: new Error('settings unavailable'), section, key, message: 'boom' }))
    : Effect.succeed(settings.values[`${section}.${key}`] ?? defaultValue);

const isCliTelemetryDisabledMock = jest.fn();
const isCliTelemetryDisabledImpl = () =>
  cliTelemetry.fail
    ? Effect.fail(new FailedToCreateConfigAggregatorError({ message: 'no workspace open' }))
    : Effect.succeed(cliTelemetry.disabled);

const MockSettingsServiceLayer = Layer.succeed(
  SettingsService,
  SettingsService.make({ getValue: getValueMock } as unknown as SettingsService)
);

const MockConfigServiceLayer = Layer.succeed(
  ConfigService,
  ConfigService.make({ isCliTelemetryDisabled: isCliTelemetryDisabledMock } as unknown as ConfigService)
);

const ProcessProto = {
  [CommandExecutor.ProcessTypeId]: CommandExecutor.ProcessTypeId,
  ...Inspectable.BaseProto,
  toJSON(this: CommandExecutor.Process) {
    return { pid: this.pid };
  }
};

const fakeProcess = (opts: {
  stdout?: string;
  stderr?: string;
  code?: number;
  hang?: boolean;
  onKill?: () => void;
}): CommandExecutor.Process => {
  const encoder = new TextEncoder();
  return Object.assign(Object.create(ProcessProto), {
    pid: CommandExecutor.ProcessId(1),
    exitCode: opts.hang ? Effect.never : Effect.succeed(CommandExecutor.ExitCode(opts.code ?? 0)),
    isRunning: Effect.succeed(Boolean(opts.hang)),
    kill: () => Effect.sync(() => opts.onKill?.()),
    stdin: Sink.drain,
    stdout: opts.hang ? Stream.never : Stream.succeed(encoder.encode(opts.stdout ?? '')),
    stderr: opts.hang ? Stream.never : Stream.succeed(encoder.encode(opts.stderr ?? ''))
  });
};

type StartResult =
  | { readonly stdout?: string; readonly stderr?: string; readonly code?: number }
  | 'hang'
  | { readonly platform: SystemError };

type Capture = { command?: Command.StandardCommand; killed: boolean };

const withStart = (result: StartResult) => {
  const capture: Capture = { killed: false };
  const start = (command: Command.Command) => {
    const [standard] = Command.flatten(command);
    capture.command = standard;
    return Effect.acquireRelease(
      result === 'hang'
        ? Effect.succeed(fakeProcess({ hang: true, onKill: () => (capture.killed = true) }))
        : 'platform' in result
          ? Effect.fail(result.platform)
          : Effect.succeed(fakeProcess(result)),
      proc => Effect.ignore(proc.kill())
    );
  };
  return {
    capture,
    layer: TerminalService.DefaultWithoutDependencies.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(CommandExecutor.CommandExecutor, CommandExecutor.makeExecutor(start)),
          MockSettingsServiceLayer,
          MockConfigServiceLayer
        )
      )
    )
  };
};

const run = <A, E>(effect: Effect.Effect<A, E, TerminalService>, layer: Layer.Layer<TerminalService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layer)));

const envOf = (command: Command.StandardCommand | undefined): Record<string, string> | undefined => {
  if (command === undefined) return undefined;
  const env = Object.fromEntries(command.env);
  return Object.keys(env).length === 0 ? undefined : env;
};

const recordingTracer = (recordedSpans: { name: string; attributes: Map<string, unknown> }[]) =>
  Layer.setTracer(
    Tracer.make({
      span: (name, parent, context, links, startTime, kind, options) => {
        const attributes = new Map<string, unknown>(Object.entries(options?.attributes ?? {}));
        recordedSpans.push({ name, attributes });
        return {
          _tag: 'Span',
          name,
          spanId: `span-${recordedSpans.length}`,
          traceId: 'trace',
          parent,
          context,
          links,
          status: { _tag: 'Started', startTime },
          attributes,
          sampled: true,
          kind,
          end: () => {},
          attribute: (key: string, value: unknown) => attributes.set(key, value),
          event: () => {},
          addLinks: () => {}
        } as Tracer.Span;
      },
      context: <X>(f: () => X) => f()
    })
  );

const originalCaCerts = process.env.NODE_EXTRA_CA_CERTS;

describe('TerminalService.simpleExec', () => {
  beforeEach(() => {
    delete process.env.ESBUILD_PLATFORM;
    delete process.env.NODE_EXTRA_CA_CERTS;
    settings.values = {};
    settings.fail = false;
    cliTelemetry.disabled = false;
    cliTelemetry.fail = false;
    getValueMock.mockImplementation(getValueImpl);
    isCliTelemetryDisabledMock.mockImplementation(isCliTelemetryDisabledImpl);
  });

  afterAll(() => {
    if (originalCaCerts !== undefined) process.env.NODE_EXTRA_CA_CERTS = originalCaCerts;
  });

  it('kills the process when the fiber is interrupted', async () => {
    const { capture, layer } = withStart('hang');

    const fiber = Effect.runFork(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'delete'], parse: s => s })),
        Effect.provide(layer)
      )
    );

    while (capture.command === undefined) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    expect(capture.killed).toBe(false);

    await Fiber.interrupt(fiber).pipe(Effect.runPromise);
    expect(capture.killed).toBe(true);
  });

  it('trims stdout and passes it to parse on the happy path', async () => {
    const { layer } = withStart({ stdout: '  hello world  \n', stderr: '' });
    const parse = jest.fn((s: string) => s.toUpperCase());

    const result = await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['foo'], parse }))),
      layer
    );

    expect(parse).toHaveBeenCalledWith('hello world');
    expect(result).toBe('HELLO WORLD');
  });

  it('executes with the executable + args separated without recording them in telemetry', async () => {
    const executable = 'sf';
    const args = ['org', 'display', '--target-org', 'user@example.com', '--json'];
    const { capture, layer } = withStart({ stdout: '{}', stderr: '' });
    const recordedSpans: { name: string; attributes: Map<string, unknown> }[] = [];

    await TerminalService.pipe(
      Effect.flatMap(terminal => terminal.simpleExec({ executable, args, parse: s => s })),
      Effect.withSpan('terminal-test'),
      Effect.provide(layer),
      Effect.provide(recordingTracer(recordedSpans)),
      Effect.runPromise
    );

    expect(capture.command?.command).toBe(executable);
    expect([...(capture.command?.args ?? [])]).toEqual(args);
    const attributes = recordedSpans.find(span => span.name === 'TerminalService.simpleExec')?.attributes;
    expect(attributes).toEqual(
      new Map<string, unknown>([
        ['terminal.timeout.ms', 30_000],
        ['terminal.cwd.set', false],
        ['envKeys', ['SF_LOG_LEVEL', 'SF_JSON_TO_STDOUT', 'FORCE_COLOR', 'SFDX_TOOL']],
        ['process.exit.code', 0],
        ['terminal.stdout.bytes', 2],
        ['terminal.stderr.bytes', 0]
      ])
    );
    expect(JSON.stringify(recordedSpans.map(span => Object.fromEntries(span.attributes)))).not.toContain(
      'user@example.com'
    );
  });

  it('records the timeout on the span', async () => {
    const { layer } = withStart({ stdout: '', stderr: '' });
    const recordedSpans: { name: string; attributes: Map<string, unknown> }[] = [];

    await TerminalService.pipe(
      Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['foo'], parse: s => s })),
      Effect.provide(layer),
      Effect.provide(recordingTracer(recordedSpans)),
      Effect.runPromise
    );

    expect(
      recordedSpans.find(span => span.name === 'TerminalService.simpleExec')?.attributes.get('terminal.timeout.ms')
    ).toBe(30_000);
  });

  it('times out a hanging process', async () => {
    const { capture, layer } = withStart('hang');
    const recordedSpans: { name: string; attributes: Map<string, unknown> }[] = [];

    const error = await TerminalService.pipe(
      Effect.flatMap(terminal =>
        terminal.simpleExec({
          executable: 'sf',
          args: ['foo'],
          parse: s => s,
          timeout: Duration.millis(1)
        })
      ),
      Effect.flip,
      Effect.provide(layer),
      Effect.provide(recordingTracer(recordedSpans)),
      Effect.runPromise
    );

    expect(error).toBeInstanceOf(TerminalServiceError);
    expect(capture.killed).toBe(true);
    expect(recordedSpans.find(span => span.name === 'TerminalService.simpleExec')?.attributes.get('error.type')).toBe(
      'timeout'
    );
  });

  it('forwards a caller env unchanged and injects no sf env for a non-sf command', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ executable: 'java', args: ['--version'], parse: s => s, env: { FOO: 'bar' } })
        )
      ),
      layer
    );

    expect(envOf(capture.command)).toEqual({ FOO: 'bar' });
  });

  it('auto-injects SF_JSON_TO_STDOUT + FORCE_COLOR + SFDX_TOOL + the default SF_LOG_LEVEL for sf commands', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)).toEqual({
      SF_LOG_LEVEL: 'fatal',
      SF_JSON_TO_STDOUT: 'true',
      FORCE_COLOR: '0',
      SFDX_TOOL: 'salesforce-vscode-extensions'
    });
  });

  it('injects the sf env based on the executable being `sf`, not an args prefix', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ executable: 'echo', args: ['sf', 'org', 'open'], parse: s => s })
        )
      ),
      layer
    );

    expect(capture.command?.command).toBe('echo');
    expect(envOf(capture.command)).toBeUndefined();
  });

  it('passes the configured SF_LOG_LEVEL through', async () => {
    settings.values['salesforcedx-vscode-core.SF_LOG_LEVEL'] = 'debug';
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)?.SF_LOG_LEVEL).toBe('debug');
  });

  it('passes NODE_EXTRA_CA_CERTS from the setting', async () => {
    settings.values['salesforcedx-vscode-core.NODE_EXTRA_CA_CERTS'] = '/certs/from-setting.pem';
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)?.NODE_EXTRA_CA_CERTS).toBe('/certs/from-setting.pem');
  });

  it('falls back to the ambient NODE_EXTRA_CA_CERTS when the setting is unset', async () => {
    process.env.NODE_EXTRA_CA_CERTS = '/certs/from-env.pem';
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)?.NODE_EXTRA_CA_CERTS).toBe('/certs/from-env.pem');
  });

  it('omits NODE_EXTRA_CA_CERTS when neither the setting nor the env var is set', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)).not.toHaveProperty('NODE_EXTRA_CA_CERTS');
  });

  it('injects SF_DISABLE_TELEMETRY when the VS Code telemetry level is off', async () => {
    settings.values['telemetry.telemetryLevel'] = 'off';
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)?.SF_DISABLE_TELEMETRY).toBe('true');
    expect(isCliTelemetryDisabledMock).not.toHaveBeenCalled();
  });

  it('injects SF_DISABLE_TELEMETRY when the core telemetry.enabled setting is false', async () => {
    settings.values['salesforcedx-vscode-core.telemetry.enabled'] = false;
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)?.SF_DISABLE_TELEMETRY).toBe('true');
  });

  it('injects SF_DISABLE_TELEMETRY when the CLI disable-telemetry config is set', async () => {
    cliTelemetry.disabled = true;
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)?.SF_DISABLE_TELEMETRY).toBe('true');
  });

  it('omits SF_DISABLE_TELEMETRY when every telemetry switch allows it', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)).not.toHaveProperty('SF_DISABLE_TELEMETRY');
  });

  it('still executes when the CLI telemetry lookup fails', async () => {
    cliTelemetry.fail = true;
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    const result = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(result).toBe('');
    expect(envOf(capture.command)).not.toHaveProperty('SF_DISABLE_TELEMETRY');
  });

  it('still executes when a settings read fails', async () => {
    settings.fail = true;
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    const result = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['org', 'open'], parse: s => s }))
      ),
      layer
    );

    expect(result).toBe('');
    expect(envOf(capture.command)).toEqual({
      SF_JSON_TO_STDOUT: 'true',
      FORCE_COLOR: '0',
      SFDX_TOOL: 'salesforce-vscode-extensions'
    });
  });

  it('lets a caller env override the auto-injected sf env', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({
            executable: 'sf',
            args: ['org', 'open'],
            parse: s => s,
            env: { FORCE_COLOR: '1', EXTRA: 'x' }
          })
        )
      ),
      layer
    );

    expect(envOf(capture.command)).toEqual({
      SF_LOG_LEVEL: 'fatal',
      SF_JSON_TO_STDOUT: 'true',
      FORCE_COLOR: '1',
      SFDX_TOOL: 'salesforce-vscode-extensions',
      EXTRA: 'x'
    });
  });

  it('lets a caller env override a gathered setting', async () => {
    settings.values['salesforcedx-vscode-core.SF_LOG_LEVEL'] = 'debug';
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({
            executable: 'sf',
            args: ['org', 'open'],
            parse: s => s,
            env: { SF_LOG_LEVEL: 'trace' }
          })
        )
      ),
      layer
    );

    expect(envOf(capture.command)?.SF_LOG_LEVEL).toBe('trace');
  });

  it('does not inject sf env for non-sf commands without a caller env', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'java', args: ['--version'], parse: s => s }))
      ),
      layer
    );

    expect(envOf(capture.command)).toBeUndefined();
    expect(getValueMock).not.toHaveBeenCalled();
    expect(isCliTelemetryDisabledMock).not.toHaveBeenCalled();
  });

  it('forwards cwd to the child when set', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ executable: 'sf', args: ['project', 'generate'], parse: s => s, cwd: '/tmp/project' })
        )
      ),
      layer
    );

    expect(Option.getOrUndefined(capture.command?.cwd ?? Option.none())).toBe('/tmp/project');
  });

  it('omits cwd when not set', async () => {
    const { capture, layer } = withStart({ stdout: '', stderr: '' });
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['foo'], parse: s => s }))
      ),
      layer
    );

    expect(Option.getOrUndefined(capture.command?.cwd ?? Option.none())).toBeUndefined();
  });

  it('preserves stdout in the error message (sf --json errors land on stdout)', async () => {
    const { layer } = withStart({
      code: 1,
      stdout: '{"name":"PortInUseError","message":"local port 1717 is already in use"}',
      stderr: ''
    });

    const error = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ executable: 'sf', args: ['org', 'login', 'web', '--json'], parse: s => s })
        ),
        Effect.flip
      ),
      layer
    );

    expect(error).toBeInstanceOf(TerminalServiceError);
    expect(error.message).toContain('local port 1717 is already in use');
  });

  it('includes stdout once when reconstructing the failure message', async () => {
    const { layer } = withStart({ code: 1, stdout: 'boom on stdout', stderr: '' });

    const error = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args: ['foo'], parse: s => s })),
        Effect.flip
      ),
      layer
    );

    expect(error.message.match(/boom on stdout/g) ?? []).toHaveLength(1);
  });

  it('omits the invocation from the typed exec failure', async () => {
    const executable = 'sf';
    const args = ['org', 'display', '--target-org', 'user@example.com', '--json'];
    const { capture, layer } = withStart({ code: 1, stdout: '', stderr: '' });

    const error = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ executable, args, parse: s => s })),
        Effect.flip
      ),
      layer
    );

    expect(capture.command?.command).toBe(executable);
    expect([...(capture.command?.args ?? [])]).toEqual(args);
    expect('command' in error).toBe(false);
    expect(error.message).toContain('Command failed');
    expect(error.message).not.toContain('user@example.com');
  });

  it('records only outcome metadata when exec fails', async () => {
    const args = ['org', 'display', '--target-org', 'user@example.com', '--json'];
    const { layer } = withStart({ code: 1, stdout: 'failure', stderr: 'warning' });
    const recordedSpans: { name: string; attributes: Map<string, unknown> }[] = [];

    await TerminalService.pipe(
      Effect.flatMap(terminal => terminal.simpleExec({ executable: 'sf', args, parse: s => s })),
      Effect.flip,
      Effect.withSpan('terminal-test'),
      Effect.provide(layer),
      Effect.provide(recordingTracer(recordedSpans)),
      Effect.runPromise
    );

    const attributes = recordedSpans.find(span => span.name === 'TerminalService.simpleExec')?.attributes;
    expect(attributes?.get('process.exit.code')).toBe(1);
    expect(attributes?.get('error.type')).toBe('nonzero_exit');
    expect(attributes?.get('terminal.stdout.bytes')).toBe(7);
    expect(attributes?.get('terminal.stderr.bytes')).toBe(7);
    expect(JSON.stringify(recordedSpans.map(span => Object.fromEntries(span.attributes)))).not.toContain(
      'user@example.com'
    );
  });

  it('fails with TerminalServiceError on web', async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    const start = jest.fn(() =>
      Effect.acquireRelease(Effect.succeed(fakeProcess({})), proc => Effect.ignore(proc.kill()))
    );
    const layer = TerminalService.DefaultWithoutDependencies.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(CommandExecutor.CommandExecutor, CommandExecutor.makeExecutor(start)),
          MockSettingsServiceLayer,
          MockConfigServiceLayer
        )
      )
    );

    const error = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({
            executable: 'sf',
            args: ['org', 'display', '--target-org', 'my-org', '--json'],
            parse: s => s
          })
        ),
        Effect.flip
      ),
      layer
    );

    expect(error).toBeInstanceOf(TerminalServiceError);
    expect('command' in error).toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(getValueMock).not.toHaveBeenCalled();
    expect(isCliTelemetryDisabledMock).not.toHaveBeenCalled();
  });
});
