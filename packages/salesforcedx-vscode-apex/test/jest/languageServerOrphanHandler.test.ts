/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import type * as Tracer from 'effect/Tracer';
import * as vscode from 'vscode';
import { UBER_JAR_NAME } from '../../src/constants';
import { nls } from '../../src/messages';
import { setTelemetryService } from '../../src/telemetry/telemetry';
import { MockTelemetryService } from './telemetry/mockTelemetryService';

jest.mock('../../src/channels', () => ({
  channelService: {
    showChannelOutput: jest.fn(),
    appendLine: jest.fn()
  }
}));

const ORPHAN_LIST = `1234 1 java -jar ${UBER_JAR_NAME}`;
const HEALTHY_LIST = `1234 5678 java -jar ${UBER_JAR_NAME}`;

type ExecResult = string | { fail: string };

/** Build a stub TerminalService.simpleExec that returns canned stdout (or a TerminalServiceError) per matched command substring. */
const makeSimpleExec =
  (responses: { match: string; result: ExecResult }[]) =>
  ({ command, parse = s => s }: { command: string; parse?: (stdout: string) => string; timeout?: unknown }) => {
    const hit = responses.find(r => command.includes(r.match));
    if (!hit) {
      return Effect.die(new Error(`unexpected command: ${command}`));
    }
    return typeof hit.result === 'string'
      ? Effect.succeed(parse(hit.result.trim()))
      : Effect.fail({ _tag: 'TerminalServiceError', message: hit.result.fail, command });
  };

type Choices = { warning?: string[]; confirm?: string[]; autoTerminateConfirm?: string[] };

/** PromptService stub mirroring considerUndefinedAsCancellation (undefined/'' → UserCancellationError by tag). */
const makePromptService = () => ({
  considerUndefinedAsCancellation: <A>(value: A | undefined) =>
    value === undefined || value === ''
      ? Effect.fail({ _tag: 'UserCancellationError', message: 'cancelled' })
      : Effect.succeed(value)
});

type SettingsStub = {
  getValueCalls: { section: string; key: string; defaultValue: unknown }[];
  setValueCalls: { section: string; key: string; value: unknown }[];
  getValueResult: unknown;
  setValueFail: boolean;
};

const makeSettingsStub = (opts: { getValueResult?: unknown; setValueFail?: boolean } = {}): SettingsStub => ({
  getValueCalls: [],
  setValueCalls: [],
  getValueResult: opts.getValueResult ?? false,
  setValueFail: opts.setValueFail ?? false
});

const makeSettingsService = (stub: SettingsStub) => ({
  getValue: (section: string, key: string, defaultValue?: unknown) => {
    stub.getValueCalls.push({ section, key, defaultValue });
    return Effect.succeed(stub.getValueResult);
  },
  setValue: (section: string, key: string, value: unknown) => {
    stub.setValueCalls.push({ section, key, value });
    if (stub.setValueFail) {
      return Effect.fail({ _tag: 'MissingSettingsError', message: 'write failed', key, section, cause: undefined });
    }
    return Effect.succeed(undefined);
  }
});

const makeApi = (responses: { match: string; result: ExecResult }[], settingsStub?: SettingsStub) => ({
  services: {
    TerminalService: Effect.succeed({ simpleExec: makeSimpleExec(responses) }),
    PromptService: Effect.succeed(makePromptService()),
    SettingsService: Effect.succeed(makeSettingsService(settingsStub ?? makeSettingsStub()))
  }
});

/**
 * Load the handler + its ExtensionProviderService tag from one isolated module graph, with `platform`
 * pinned at module-load time, and bind the telemetry mock into that graph.
 *
 * The handler captures `process.platform` into a module-level `isWindows` constant on import, so the
 * platform must be set before requiring it — otherwise on Windows CI the non-Windows tests would hit
 * the powershell command path their stubs don't mock. The ExtensionProviderService tag is re-required
 * from the same graph so the provided service matches the tag identity the handler resolves against.
 */
const loadHandler = (platform: NodeJS.Platform, telemetry: MockTelemetryService) => {
  const original = process.platform;
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  let result:
    | {
        checkAndResolveOrphanedLanguageServers: typeof import('../../src/languageServerOrphanHandler').checkAndResolveOrphanedLanguageServers;
        Provider: typeof ExtensionProviderService;
      }
    | undefined;
  jest.isolateModules(() => {
    (require('../../src/telemetry/telemetry') as typeof import('../../src/telemetry/telemetry')).setTelemetryService(
      telemetry
    );
    const { ExtensionProviderService: Provider } =
      require('@salesforce/effect-ext-utils') as typeof import('@salesforce/effect-ext-utils');
    const { checkAndResolveOrphanedLanguageServers } =
      require('../../src/languageServerOrphanHandler') as typeof import('../../src/languageServerOrphanHandler');
    result = { checkAndResolveOrphanedLanguageServers, Provider };
  });
  Object.defineProperty(process, 'platform', { value: original, configurable: true });
  return result!;
};

const provide =
  (
    Provider: typeof ExtensionProviderService,
    responses: { match: string; result: ExecResult }[],
    settingsStub?: SettingsStub
  ) =>
  (effect: Effect.Effect<unknown, unknown, unknown>) =>
    effect.pipe(
      Effect.provideService(Provider, {
        getServicesApi: Effect.succeed(makeApi(responses, settingsStub))
      } as unknown as ExtensionProviderService)
    );

// Capture the root span so tests can assert the annotations the handler writes via annotateRootSpan.
const captureRoot = (holder: { root?: Tracer.Span }) => (effect: Effect.Effect<void>) =>
  Effect.gen(function* () {
    holder.root = yield* Effect.currentSpan;
    return yield* effect;
  }).pipe(Effect.withSpan('test-root')) as Effect.Effect<void>;

const run = (
  telemetry: MockTelemetryService,
  responses: { match: string; result: ExecResult }[],
  holder: { root?: Tracer.Span } = {},
  settingsStub?: SettingsStub
) => {
  const { checkAndResolveOrphanedLanguageServers, Provider } = loadHandler('darwin', telemetry);
  return Effect.runPromise(
    (
      checkAndResolveOrphanedLanguageServers().pipe(provide(Provider, responses, settingsStub)) as Effect.Effect<void>
    ).pipe(captureRoot(holder))
  );
};

// Mirrors killOne's retry schedule in languageServerOrphanHandler.ts: Schedule.exponential('2 seconds') x recurs(2).
// Keep in sync with the handler; the adjust window below is derived from these so the retry tests can never
// silently stop exercising retries if the backoff grows.
const KILL_RETRY_BASE_SECONDS = 2;
const KILL_RETRY_COUNT = 2;
// exponential backoff total: 2s + 4s = sum over i of base*2^i for i in [0, count)
const KILL_RETRY_TOTAL_SECONDS = Array.from(
  { length: KILL_RETRY_COUNT },
  (_unused, i) => KILL_RETRY_BASE_SECONDS * 2 ** i
).reduce((sum, s) => sum + s, 0);

/** Run on the TestClock, advancing past the (bounded) kill-retry backoff so scheduled retries fire without real waits. */
const runWithClock = (
  telemetry: MockTelemetryService,
  responses: { match: string; result: ExecResult }[],
  holder: { root?: Tracer.Span } = {},
  settingsStub?: SettingsStub
) => {
  const { checkAndResolveOrphanedLanguageServers, Provider } = loadHandler('darwin', telemetry);
  return Effect.runPromise(
    Effect.gen(function* () {
      holder.root = yield* Effect.currentSpan;
      const fiber = yield* Effect.fork(
        checkAndResolveOrphanedLanguageServers().pipe(provide(Provider, responses, settingsStub))
      );
      yield* TestClock.adjust(Duration.seconds(KILL_RETRY_TOTAL_SECONDS + 1));
      return yield* Fiber.join(fiber);
    }).pipe(Effect.withSpan('test-root'), Effect.provide(TestContext.TestContext)) as Effect.Effect<void>
  );
};

const setWarningChoices = ({ warning = [], confirm = [], autoTerminateConfirm = [] }: Choices) => {
  const queue = [...warning];
  const confirmQueue = [...confirm];
  const autoTerminateConfirmQueue = [...autoTerminateConfirm];
  (vscode.window.showWarningMessage as jest.Mock).mockImplementation((message: string, ...args: unknown[]) => {
    // Route based on message content and modal option presence
    const hasModal = args.some(
      a => typeof a === 'object' && a !== null && 'modal' in a && (a as { modal: boolean }).modal
    );
    if (message.includes('Terminate them?')) {
      return Promise.resolve(confirmQueue.shift());
    }
    if (hasModal && message.includes(nls.localize('always_auto_terminate'))) {
      return Promise.resolve(autoTerminateConfirmQueue.shift());
    }
    return Promise.resolve(queue.shift());
  });
};

describe('languageServerOrphanHandler', () => {
  let telemetry: MockTelemetryService;
  let killSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    telemetry = new MockTelemetryService();
    telemetry.sendEventData = jest.fn();
    telemetry.sendException = jest.fn();
    setTelemetryService(telemetry);
    killSpy = jest.spyOn(process, 'kill').mockReturnValue(true);
    delete process.env.ESBUILD_PLATFORM;
  });

  afterEach(() => {
    killSpy.mockRestore();
  });

  it('no orphan processes → no prompt, no kill', async () => {
    await run(telemetry, [{ match: 'ps -e', result: '' }]);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('parent alive → not orphaned → no prompt', async () => {
    await run(telemetry, [
      { match: 'ps -e', result: HEALTHY_LIST },
      { match: 'ps -p 5678', result: 'alive' }
    ]);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('orphan found + user confirms → kill called', async () => {
    setWarningChoices({ warning: [nls.localize('terminate_processes')], confirm: [nls.localize('yes')] });
    await run(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }]);
    expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
  });

  it('user dismisses prompt → UserCancellationError caught → no kill', async () => {
    setWarningChoices({ warning: [undefined as unknown as string] });
    await run(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }]);
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('kill fails twice then succeeds → retry within bound, no exception telemetry', async () => {
    setWarningChoices({ warning: [nls.localize('terminate_processes')], confirm: [nls.localize('yes')] });
    killSpy
      .mockImplementationOnce(() => {
        throw new Error('boom1');
      })
      .mockImplementationOnce(() => {
        throw new Error('boom2');
      })
      .mockReturnValueOnce(true);
    await runWithClock(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }]);
    expect(killSpy).toHaveBeenCalledTimes(3);
    expect(telemetry.sendException).not.toHaveBeenCalled();
  });

  it('kill fails all attempts → ProcessTerminationError caught internally + root-span annotation, never propagates', async () => {
    setWarningChoices({ warning: [nls.localize('terminate_processes')], confirm: [nls.localize('yes')] });
    killSpy.mockImplementation(() => {
      throw new Error('always');
    });
    const holder: { root?: Tracer.Span } = {};
    await expect(runWithClock(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }], holder)).resolves.toBeUndefined();
    expect(killSpy).toHaveBeenCalledTimes(3);
    expect(telemetry.sendException).not.toHaveBeenCalled();
    expect(holder.root?.attributes.get('orphanKillError')).toBe('always');
  });

  it('web platform → TerminalServiceError → empty result, no prompt', async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    await run(telemetry, [{ match: 'ps -e', result: { fail: 'Not available on web' } }]);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  describe('autoTerminateOrphanedProcesses setting', () => {
    it('setting true + orphans found → kills without prompt', async () => {
      const stub = makeSettingsStub({ getValueResult: true });
      await run(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }], {}, stub);
      expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
      expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
      expect(stub.getValueCalls).toEqual([
        { section: 'salesforcedx-vscode-apex', key: 'autoTerminateOrphanedProcesses', defaultValue: false }
      ]);
    });

    it('setting false + user clicks "Always Auto-Terminate" + confirms modal → setValue called + kills', async () => {
      const stub = makeSettingsStub({ getValueResult: false });
      setWarningChoices({
        warning: [nls.localize('always_auto_terminate')],
        autoTerminateConfirm: [nls.localize('confirm')]
      });
      await run(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }], {}, stub);
      expect(stub.setValueCalls).toEqual([
        { section: 'salesforcedx-vscode-apex', key: 'autoTerminateOrphanedProcesses', value: true }
      ]);
      expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
    });

    it('setting false + user clicks "Always Auto-Terminate" + cancels modal → no kill, setValue not called', async () => {
      const stub = makeSettingsStub({ getValueResult: false });
      setWarningChoices({
        warning: [nls.localize('always_auto_terminate')],
        autoTerminateConfirm: [undefined as unknown as string]
      });
      await run(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }], {}, stub);
      expect(stub.setValueCalls).toEqual([]);
      expect(killSpy).not.toHaveBeenCalled();
    });

    it('setting false + existing flows unchanged (terminate, show, dismiss)', async () => {
      const stub = makeSettingsStub({ getValueResult: false });
      setWarningChoices({
        warning: [nls.localize('terminate_processes')],
        confirm: [nls.localize('yes')]
      });
      await run(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }], {}, stub);
      expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
      expect(stub.setValueCalls).toEqual([]);
    });

    it('SettingsService.setValue failure → span annotation recorded, kill still proceeds', async () => {
      const stub = makeSettingsStub({ getValueResult: false, setValueFail: true });
      const holder: { root?: Tracer.Span } = {};
      setWarningChoices({
        warning: [nls.localize('always_auto_terminate')],
        autoTerminateConfirm: [nls.localize('confirm')]
      });
      await run(telemetry, [{ match: 'ps -e', result: ORPHAN_LIST }], holder, stub);
      expect(holder.root?.attributes.get('settingsWriteError')).toBe('write failed');
      expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
    });
  });
});

describe('languageServerOrphanHandler (Windows powershell guard)', () => {
  const originalPlatform = process.platform;
  let telemetry: MockTelemetryService;

  beforeEach(() => {
    jest.clearAllMocks();
    telemetry = new MockTelemetryService();
    telemetry.sendException = jest.fn();
    setTelemetryService(telemetry);
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  });

  it('where powershell fails → empty result + root-span annotation, no prompt', async () => {
    // Build the effect + its service provision entirely inside the isolated module graph so the handler's
    // module-level isWindows (true here) and the ExtensionProviderService tag identity stay consistent.
    const holder: { root?: Tracer.Span } = {};
    let program: Effect.Effect<void> | undefined;
    jest.isolateModules(() => {
      const telemetryModule =
        require('../../src/telemetry/telemetry') as typeof import('../../src/telemetry/telemetry');
      telemetryModule.setTelemetryService(telemetry);
      const { ExtensionProviderService: IsolatedProvider } =
        require('@salesforce/effect-ext-utils') as typeof import('@salesforce/effect-ext-utils');
      const { checkAndResolveOrphanedLanguageServers: checkOnWindows } =
        require('../../src/languageServerOrphanHandler') as typeof import('../../src/languageServerOrphanHandler');
      program = Effect.gen(function* () {
        holder.root = yield* Effect.currentSpan;
        return yield* checkOnWindows().pipe(
          Effect.provideService(IsolatedProvider, {
            getServicesApi: Effect.succeed(
              makeApi([{ match: 'where powershell', result: { fail: 'powershell not found' } }])
            )
          } as unknown as ExtensionProviderService)
        );
      }).pipe(Effect.withSpan('test-root')) as Effect.Effect<void>;
    });
    const killSpy = jest.spyOn(process, 'kill').mockReturnValue(true);

    await Effect.runPromise(program!);

    expect(holder.root?.attributes.get('orphanCheckError')).toBe('powershell not found');
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
    killSpy.mockRestore();
  });
});
