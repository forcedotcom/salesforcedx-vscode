/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import * as vscode from 'vscode';
import { getErrorMessage } from 'salesforcedx-vscode-services/src/vscode/errorHandlerService';

// Control the artifact writers so we can drive success / failure exit paths.
const streamAndWriteSobjectArtifacts = jest.fn();
const writeSobjectArtifacts = jest.fn();
jest.mock('../../../src/commands/sobjectArtifactWriter', () => ({
  streamAndWriteSobjectArtifacts: (...args: unknown[]) => streamAndWriteSobjectArtifacts(...args),
  writeSobjectArtifacts: (...args: unknown[]) => writeSobjectArtifacts(...args)
}));

import { refreshSObjectsCommand, SOBJECT_REFRESH_COMPLETE_CMD } from '../../../src/commands/refreshSObjects';

const SUCCESS_CODE = 0;
const FAILURE_CODE = 1;

const appendToChannel = jest.fn(() => Effect.void);

// Stand-in PromptService.withCancellableProgressReporting: runs the build effect with a mock
// progress + uncancelled token in the same fiber, so a typed failure propagates unchanged.
const mockPromptService = {
  withCancellableProgressReporting:
    (_title: string, _location?: vscode.ProgressLocation) =>
    <A, E, R>(build: (progress: unknown, token: unknown) => Effect.Effect<A, E, R>) =>
      build({ report: jest.fn() }, { isCancellationRequested: false, onCancellationRequested: jest.fn() })
};

const createMockServicesApi = () => ({
  services: {
    ChannelService: Effect.succeed({ appendToChannel }),
    PromptService: Effect.succeed(mockPromptService),
    UserCancellationError
  }
});

const createMockExtensionProvider = () =>
  ({ getServicesApi: Effect.succeed(createMockServicesApi()) }) as unknown as ExtensionProviderService;

// Mirror registerCommand's outer handling: swallow UserCancellationError, route other causes through the
// real getErrorMessage (walks the cause chain to the real message) then showErrorMessage — the shared toast path.
const showErrorMessage = vscode.window.showErrorMessage as jest.Mock;

const runCommand = (source?: Parameters<typeof refreshSObjectsCommand>[0]) =>
  Effect.runPromiseExit(
    refreshSObjectsCommand(source).pipe(
      Effect.catchTag('UserCancellationError', () => Effect.void),
      Effect.catchAllCause(cause =>
        Effect.sync(() => void vscode.window.showErrorMessage(getErrorMessage(Cause.squash(cause))))
      ),
      Effect.provideService(ExtensionProviderService, createMockExtensionProvider())
    ) as Effect.Effect<unknown, never, never>
  );

const executeCommand = vscode.commands.executeCommand as jest.Mock;
const getExtension = vscode.extensions.getExtension as jest.Mock;

describe('refreshSObjects module', () => {
  it('exports refreshSObjectsCommand', () => {
    expect(typeof refreshSObjectsCommand).toBe('function');
  });

  it('exports the correct completion command ID', () => {
    expect(SOBJECT_REFRESH_COMPLETE_CMD).toBe('sf.internal.sobjectrefresh.complete');
  });
});

describe('refreshSObjectsCommand completion + error surfacing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getExtension.mockReturnValue({}); // core extension present
    appendToChannel.mockReturnValue(Effect.void);
  });

  it('emits SUCCESS_CODE on a successful refresh', async () => {
    writeSobjectArtifacts.mockReturnValue(
      Effect.succeed({ data: { cancelled: false, standardObjects: 3, customObjects: 2 } })
    );

    const exit = await runCommand('startupmin');

    expect(exit._tag).toBe('Success');
    expect(executeCommand).toHaveBeenCalledWith(SOBJECT_REFRESH_COMPLETE_CMD, { exitCode: SUCCESS_CODE });
  });

  it('surfaces the real underlying error (not "An error has occurred") and emits FAILURE_CODE', async () => {
    // FsServiceError-shaped typed failure with a real message on its cause.
    class FsServiceError extends Error {
      public readonly _tag = 'FsServiceError';
      public readonly cause = new Error('EACCES: permission denied, open sobjects');
      constructor() {
        super('EACCES: permission denied, open sobjects');
      }
    }
    writeSobjectArtifacts.mockReturnValue(Effect.fail(new FsServiceError()));

    const exit = await runCommand('startupmin');

    expect(exit._tag).toBe('Success'); // handleCause swallows the failure
    // FAILURE_CODE emitted via onExit on the failed exit
    expect(executeCommand).toHaveBeenCalledWith(SOBJECT_REFRESH_COMPLETE_CMD, { exitCode: FAILURE_CODE });
    // real text reached the toast, never the generic string
    const toastArgs = showErrorMessage.mock.calls.map(c => String(c[0]));
    expect(toastArgs.some(m => m.includes('EACCES: permission denied'))).toBe(true);
    expect(toastArgs).not.toContain('An error has occurred');
  });

  it('emits FAILURE_CODE when the writer reports token-based cancellation', async () => {
    writeSobjectArtifacts.mockReturnValue(
      Effect.succeed({ data: { cancelled: true, standardObjects: 0, customObjects: 0 } })
    );

    const exit = await runCommand('startupmin');

    expect(exit._tag).toBe('Success'); // UserCancellationError swallowed
    expect(executeCommand).toHaveBeenCalledWith(SOBJECT_REFRESH_COMPLETE_CMD, { exitCode: FAILURE_CODE });
  });
});
