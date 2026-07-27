/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import { ConfigService, FailedToCreateConfigAggregatorError } from '../../../src/core/configService';
import { ChildProcess, ExecOptions, ExecResult } from '../../../src/terminal/childProcess';
import { TerminalService, TerminalServiceError } from '../../../src/terminal/terminalService';
import { SettingsError, SettingsService } from '../../../src/vscode/settingsService';

// per-case knobs for the stubbed settings/config reads, reset in beforeEach
const settings: { values: Record<string, unknown>; fail: boolean } = { values: {}, fail: false };
const cliTelemetry: { disabled: boolean; fail: boolean } = { disabled: false, fail: false };

// jest.base.config sets resetMocks, so the implementations are (re)installed in beforeEach
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

// Swap the ChildProcess seam via the Effect layer instead of mocking node:child_process. This keeps
// ts-jest on isolatedModules:true for the whole package (no commonjs downlevel needed for this suite).
const withExec = (exec: (command: string, options: ExecOptions) => Promise<ExecResult>) =>
  TerminalService.DefaultWithoutDependencies.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ChildProcess, ChildProcess.make({ exec })),
        MockSettingsServiceLayer,
        MockConfigServiceLayer
      )
    )
  );

const run = <A, E>(effect: Effect.Effect<A, E, TerminalService>, layer: Layer.Layer<TerminalService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(layer)));

// the NODE_EXTRA_CA_CERTS setting falls back to the ambient env var, which a corp-proxy machine sets
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

  it('aborts the child signal when the fiber is interrupted', async () => {
    let capturedSignal: AbortSignal | undefined;
    // never resolves: the promise stays in flight until the runtime aborts the signal on interrupt
    const exec = (_command: string, options: ExecOptions): Promise<ExecResult> => {
      capturedSignal = options.signal;
      return new Promise<ExecResult>(() => {});
    };

    const fiber = Effect.runFork(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org delete', parse: s => s })),
        Effect.provide(withExec(exec))
      )
    );

    // poll until the fiber reaches the in-flight exec call (avoids a fixed-sleep race under CI load)
    while (capturedSignal === undefined) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    expect(capturedSignal.aborted).toBe(false);

    await Effect.runPromise(Fiber.interrupt(fiber));
    expect(capturedSignal.aborted).toBe(true);
  });

  it('trims stdout and passes it to parse on the happy path', async () => {
    const exec = (): Promise<ExecResult> => Promise.resolve({ stdout: '  hello world  \n', stderr: '' });
    const parse = jest.fn((s: string) => s.toUpperCase());

    const result = await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf foo', parse }))),
      withExec(exec)
    );

    expect(parse).toHaveBeenCalledWith('hello world');
    expect(result).toBe('HELLO WORLD');
  });

  it('passes the timeout through to exec', async () => {
    let capturedOptions: ExecOptions | undefined;
    const exec = (_command: string, options: ExecOptions): Promise<ExecResult> => {
      capturedOptions = options;
      return Promise.resolve({ stdout: '', stderr: '' });
    };

    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf foo', parse: s => s }))),
      withExec(exec)
    );

    expect(capturedOptions?.timeout).toBe(30_000);
  });

  // shared exec stub that captures the options simpleExec forwards to childProcess.exec
  const capturingExec = (capture: { options?: ExecOptions }) => (_command: string, options: ExecOptions) => {
    capture.options = options;
    return Promise.resolve({ stdout: '', stderr: '' });
  };

  it('forwards a caller env unchanged and injects no sf env for a non-sf command', async () => {
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ command: 'java --version', parse: s => s, env: { FOO: 'bar' } })
        )
      ),
      withExec(capturingExec(capture))
    );

    // non-sf command: caller env passes through with no SF_JSON_TO_STDOUT/FORCE_COLOR/SFDX_TOOL injected. (The
    // `{ ...process.env, ...env }` merge lives in resolveExecOptions, covered in childProcess.test.ts.)
    expect(capture.options?.env).toEqual({ FOO: 'bar' });
  });

  it('auto-injects SF_JSON_TO_STDOUT + FORCE_COLOR + SFDX_TOOL + the default SF_LOG_LEVEL for sf commands', async () => {
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    // SF_LOG_LEVEL falls back to the manifest default; NODE_EXTRA_CA_CERTS and SF_DISABLE_TELEMETRY are
    // omitted (no setting, no ambient var, telemetry allowed)
    expect(capture.options?.env).toEqual({
      SF_LOG_LEVEL: 'fatal',
      SF_JSON_TO_STDOUT: 'true',
      FORCE_COLOR: '0',
      SFDX_TOOL: 'salesforce-vscode-extensions'
    });
  });

  it('passes the configured SF_LOG_LEVEL through', async () => {
    settings.values['salesforcedx-vscode-core.SF_LOG_LEVEL'] = 'debug';
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.env?.SF_LOG_LEVEL).toBe('debug');
  });

  it('passes NODE_EXTRA_CA_CERTS from the setting', async () => {
    settings.values['salesforcedx-vscode-core.NODE_EXTRA_CA_CERTS'] = '/certs/from-setting.pem';
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.env?.NODE_EXTRA_CA_CERTS).toBe('/certs/from-setting.pem');
  });

  it('falls back to the ambient NODE_EXTRA_CA_CERTS when the setting is unset', async () => {
    process.env.NODE_EXTRA_CA_CERTS = '/certs/from-env.pem';
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.env?.NODE_EXTRA_CA_CERTS).toBe('/certs/from-env.pem');
  });

  it('omits NODE_EXTRA_CA_CERTS when neither the setting nor the env var is set', async () => {
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    // an empty NODE_EXTRA_CA_CERTS breaks node's TLS bootstrap, so the key must be absent entirely
    expect(capture.options?.env).not.toHaveProperty('NODE_EXTRA_CA_CERTS');
  });

  it('injects SF_DISABLE_TELEMETRY when the VS Code telemetry level is off', async () => {
    settings.values['telemetry.telemetryLevel'] = 'off';
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.env?.SF_DISABLE_TELEMETRY).toBe('true');
    // VS Code's own switch wins outright — no sf-config read needed
    expect(isCliTelemetryDisabledMock).not.toHaveBeenCalled();
  });

  it('injects SF_DISABLE_TELEMETRY when the core telemetry.enabled setting is false', async () => {
    settings.values['salesforcedx-vscode-core.telemetry.enabled'] = false;
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.env?.SF_DISABLE_TELEMETRY).toBe('true');
  });

  it('injects SF_DISABLE_TELEMETRY when the CLI disable-telemetry config is set', async () => {
    cliTelemetry.disabled = true;
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.env?.SF_DISABLE_TELEMETRY).toBe('true');
  });

  it('omits SF_DISABLE_TELEMETRY when every telemetry switch allows it', async () => {
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    // absent (not 'false') so re-enabling telemetry mid-session takes effect on the next command
    expect(capture.options?.env).not.toHaveProperty('SF_DISABLE_TELEMETRY');
  });

  it('still executes when the CLI telemetry lookup fails', async () => {
    cliTelemetry.fail = true;
    const capture: { options?: ExecOptions } = {};
    const result = await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(result).toBe('');
    expect(capture.options?.env).not.toHaveProperty('SF_DISABLE_TELEMETRY');
  });

  it('still executes when a settings read fails', async () => {
    settings.fail = true;
    const capture: { options?: ExecOptions } = {};
    const result = await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org open', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(result).toBe('');
    // the settings-derived env is dropped wholesale, but the always-injected sf flags survive
    expect(capture.options?.env).toEqual({
      SF_JSON_TO_STDOUT: 'true',
      FORCE_COLOR: '0',
      SFDX_TOOL: 'salesforce-vscode-extensions'
    });
  });

  it('lets a caller env override the auto-injected sf env', async () => {
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ command: 'sf org open', parse: s => s, env: { FORCE_COLOR: '1', EXTRA: 'x' } })
        )
      ),
      withExec(capturingExec(capture))
    );

    // caller FORCE_COLOR wins over the injected '0'; injected SF_JSON_TO_STDOUT/SFDX_TOOL/SF_LOG_LEVEL and caller EXTRA all present
    expect(capture.options?.env).toEqual({
      SF_LOG_LEVEL: 'fatal',
      SF_JSON_TO_STDOUT: 'true',
      FORCE_COLOR: '1',
      SFDX_TOOL: 'salesforce-vscode-extensions',
      EXTRA: 'x'
    });
  });

  it('lets a caller env override a gathered setting', async () => {
    settings.values['salesforcedx-vscode-core.SF_LOG_LEVEL'] = 'debug';
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ command: 'sf org open', parse: s => s, env: { SF_LOG_LEVEL: 'trace' } })
        )
      ),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.env?.SF_LOG_LEVEL).toBe('trace');
  });

  it('does not inject sf env for non-sf commands without a caller env', async () => {
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ command: 'java --version', parse: s => s }))
      ),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.env).toBeUndefined();
    // nothing is gathered for a non-sf command
    expect(getValueMock).not.toHaveBeenCalled();
    expect(isCliTelemetryDisabledMock).not.toHaveBeenCalled();
  });

  it('forwards cwd to the child exec when set', async () => {
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(
        Effect.flatMap(terminal =>
          terminal.simpleExec({ command: 'sf project generate', parse: s => s, cwd: '/tmp/project' })
        )
      ),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.cwd).toBe('/tmp/project');
  });

  it('omits cwd from the child exec when not set', async () => {
    const capture: { options?: ExecOptions } = {};
    await run(
      TerminalService.pipe(Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf foo', parse: s => s }))),
      withExec(capturingExec(capture))
    );

    expect(capture.options?.cwd).toBeUndefined();
  });

  it('folds exec-rejection stdout into the error message (sf --json errors land on stdout)', async () => {
    // node's exec rejection appends stderr to .message but never stdout; `sf --json` writes its
    // PortInUseError payload to stdout, so the message must carry it for callers to detect.
    const rejection = Object.assign(new Error('Command failed: sf org login web --json\n'), {
      stdout: '{"name":"PortInUseError","message":"local port 1717 is already in use"}',
      stderr: ''
    });
    const exec = (): Promise<ExecResult> => Promise.reject(rejection);

    const error = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf org login web --json', parse: s => s })),
        Effect.flip
      ),
      withExec(exec)
    );

    expect(error).toBeInstanceOf(TerminalServiceError);
    expect(error.message).toContain('local port 1717 is already in use');
  });

  it('does not duplicate stdout already present in the error message', async () => {
    const rejection = Object.assign(new Error('Command failed: sf foo\nboom on stdout'), {
      stdout: 'boom on stdout',
      stderr: ''
    });
    const exec = (): Promise<ExecResult> => Promise.reject(rejection);

    const error = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf foo', parse: s => s })),
        Effect.flip
      ),
      withExec(exec)
    );

    expect(error.message.match(/boom on stdout/g) ?? []).toHaveLength(1);
  });

  it('fails with TerminalServiceError on web', async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    const exec = (): Promise<ExecResult> => Promise.reject(new Error('should not be called on web'));

    const error = await run(
      TerminalService.pipe(
        Effect.flatMap(terminal => terminal.simpleExec({ command: 'sf foo', parse: s => s })),
        Effect.flip
      ),
      withExec(exec)
    );

    expect(error).toBeInstanceOf(TerminalServiceError);
    expect(error.command).toBe('sf foo');
    // the web guard short-circuits before any settings/config work
    expect(getValueMock).not.toHaveBeenCalled();
    expect(isCliTelemetryDisabledMock).not.toHaveBeenCalled();
  });
});
