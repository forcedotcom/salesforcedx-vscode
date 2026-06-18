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
import * as vscode from 'vscode';
import { UBER_JAR_NAME } from '../../src/constants';
import { checkAndResolveOrphanedLanguageServers } from '../../src/languageServerOrphanHandler';
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
  (command: string, parse: (stdout: string) => string = s => s) => {
    const hit = responses.find(r => command.includes(r.match));
    if (!hit) {
      return Effect.die(new Error(`unexpected command: ${command}`));
    }
    return typeof hit.result === 'string'
      ? Effect.succeed(parse(hit.result.trim()))
      : Effect.fail({ _tag: 'TerminalServiceError', message: hit.result.fail, command });
  };

type Choices = { warning?: string[]; confirm?: string[] };

/** PromptService stub mirroring considerUndefinedAsCancellation (undefined/'' → UserCancellationError by tag). */
const makePromptService = () => ({
  considerUndefinedAsCancellation: <A>(value: A | undefined) =>
    value === undefined || value === ''
      ? Effect.fail({ _tag: 'UserCancellationError', message: 'cancelled' })
      : Effect.succeed(value)
});

const makeApi = (responses: { match: string; result: ExecResult }[]) => ({
  services: {
    TerminalService: Effect.succeed({ simpleExec: makeSimpleExec(responses) }),
    PromptService: Effect.succeed(makePromptService())
  }
});

const provide =
  (responses: { match: string; result: ExecResult }[]) => (effect: Effect.Effect<unknown, unknown, unknown>) =>
    effect.pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed(makeApi(responses))
      } as unknown as ExtensionProviderService)
    );

const run = (responses: { match: string; result: ExecResult }[]) =>
  Effect.runPromise(checkAndResolveOrphanedLanguageServers().pipe(provide(responses)) as Effect.Effect<void>);

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
const runWithClock = (responses: { match: string; result: ExecResult }[]) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fiber = yield* Effect.fork(checkAndResolveOrphanedLanguageServers().pipe(provide(responses)));
      yield* TestClock.adjust(Duration.seconds(KILL_RETRY_TOTAL_SECONDS + 1));
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestContext.TestContext)) as Effect.Effect<void>
  );

const setWarningChoices = ({ warning = [], confirm = [] }: Choices) => {
  const queue = [...warning];
  const confirmQueue = [...confirm];
  (vscode.window.showWarningMessage as jest.Mock).mockImplementation((message: string) =>
    Promise.resolve(message.includes('Terminate them?') ? confirmQueue.shift() : queue.shift())
  );
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
    await run([{ match: 'ps -e', result: '' }]);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('parent alive → not orphaned → no prompt', async () => {
    await run([
      { match: 'ps -e', result: HEALTHY_LIST },
      { match: 'ps -p 5678', result: 'alive' }
    ]);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('orphan found + user confirms → kill called + didTerminate telemetry', async () => {
    setWarningChoices({ warning: [nls.localize('terminate_processes')], confirm: [nls.localize('yes')] });
    await run([{ match: 'ps -e', result: ORPHAN_LIST }]);
    expect(killSpy).toHaveBeenCalledWith(1234, 'SIGKILL');
    expect(telemetry.sendEventData).toHaveBeenCalledWith('apexLSPOrphan', undefined, {
      orphanCount: 1,
      didTerminate: 1
    });
  });

  it('user dismisses prompt → UserCancellationError caught → no kill, didTerminate 0', async () => {
    setWarningChoices({ warning: [undefined as unknown as string] });
    await run([{ match: 'ps -e', result: ORPHAN_LIST }]);
    expect(killSpy).not.toHaveBeenCalled();
    expect(telemetry.sendEventData).toHaveBeenCalledWith('apexLSPOrphan', undefined, {
      orphanCount: 1,
      didTerminate: 0
    });
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
    await runWithClock([{ match: 'ps -e', result: ORPHAN_LIST }]);
    expect(killSpy).toHaveBeenCalledTimes(3);
    expect(telemetry.sendException).not.toHaveBeenCalled();
  });

  it('kill fails all attempts → ProcessTerminationError caught internally + sendException, never propagates', async () => {
    setWarningChoices({ warning: [nls.localize('terminate_processes')], confirm: [nls.localize('yes')] });
    killSpy.mockImplementation(() => {
      throw new Error('always');
    });
    await expect(runWithClock([{ match: 'ps -e', result: ORPHAN_LIST }])).resolves.toBeUndefined();
    expect(killSpy).toHaveBeenCalledTimes(3);
    expect(telemetry.sendException).toHaveBeenCalledWith('apexLSPOrphan', 'always');
  });

  it('web platform → TerminalServiceError → empty result, no prompt', async () => {
    process.env.ESBUILD_PLATFORM = 'web';
    await run([{ match: 'ps -e', result: { fail: 'Not available on web' } }]);
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
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

  it('where powershell fails → empty result + no-powershell telemetry, no prompt', async () => {
    // Build the effect + its service provision entirely inside the isolated module graph so the handler's
    // module-level isWindows (true here) and the ExtensionProviderService tag identity stay consistent.
    let program: Effect.Effect<void> | undefined;
    jest.isolateModules(() => {
      const telemetryModule =
        require('../../src/telemetry/telemetry') as typeof import('../../src/telemetry/telemetry');
      telemetryModule.setTelemetryService(telemetry);
      const { ExtensionProviderService: IsolatedProvider } =
        require('@salesforce/effect-ext-utils') as typeof import('@salesforce/effect-ext-utils');
      const { checkAndResolveOrphanedLanguageServers: checkOnWindows } =
        require('../../src/languageServerOrphanHandler') as typeof import('../../src/languageServerOrphanHandler');
      program = checkOnWindows().pipe(
        Effect.provideService(IsolatedProvider, {
          getServicesApi: Effect.succeed(
            makeApi([{ match: 'where powershell', result: { fail: 'powershell not found' } }])
          )
        } as unknown as ExtensionProviderService)
      ) as Effect.Effect<void>;
    });
    const killSpy = jest.spyOn(process, 'kill').mockReturnValue(true);

    await Effect.runPromise(program!);

    expect(telemetry.sendException).toHaveBeenCalledWith('apex_lsp_orphan', 'powershell not found');
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
    killSpy.mockRestore();
  });
});
