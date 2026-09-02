/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { LAST_OPENED_LOG_FOLDER_KEY, LAST_OPENED_LOG_KEY } from '../../src/debuggerConstants';

jest.mock('vscode');

const promptService = {
  considerUndefinedAsCancellation: <T>(value: T | undefined) =>
    value === undefined ? Effect.fail(new UserCancellationError()) : Effect.succeed(value)
};
const extensionProviderLayer = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed({
    services: {
      PromptService: Effect.succeed(promptService)
    }
  })
} as unknown as ExtensionProviderService);
const update = jest.fn();
const extensionContext = {
  workspaceState: { update }
} as unknown as vscode.ExtensionContext;

let promptForLogFile: (typeof import('../../src/index'))['promptForLogFile'];

describe('promptForLogFile', () => {
  beforeAll(() => {
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue({ isActive: true });
    (vscode.window as unknown as { showOpenDialog: jest.Mock }).showOpenDialog = jest.fn();
    promptForLogFile = jest.requireActual<typeof import('../../src/index')>('../../src/index').promptForLogFile;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails as cancellation without persisting state when the dialog is dismissed', async () => {
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(undefined);

    const exit = await Effect.runPromiseExit(
      promptForLogFile(extensionContext, undefined).pipe(Effect.provide(extensionProviderLayer)) as Effect.Effect<
        string,
        unknown,
        never
      >
    );

    expect(Exit.isFailure(exit) && exit.cause).toMatchObject({ error: { _tag: 'UserCancellationError' } });
    expect(update).not.toHaveBeenCalled();
  });

  it('returns and persists the selected log path', async () => {
    const fileUri = URI.file('/logs/example.log');
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([fileUri]);

    const result = await Effect.runPromise(
      promptForLogFile(extensionContext, undefined).pipe(Effect.provide(extensionProviderLayer)) as Effect.Effect<
        string,
        unknown,
        never
      >
    );

    expect(result).toBe(fileUri.fsPath);
    expect(update).toHaveBeenNthCalledWith(1, LAST_OPENED_LOG_KEY, fileUri.fsPath);
    expect(update).toHaveBeenNthCalledWith(2, LAST_OPENED_LOG_FOLDER_KEY, URI.file('/logs').fsPath);
  });
});
