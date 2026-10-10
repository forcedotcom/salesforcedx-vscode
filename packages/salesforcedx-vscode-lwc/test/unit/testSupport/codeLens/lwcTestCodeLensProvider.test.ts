/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Mock as VitestMock, MockInstance as VitestMockInstance } from 'vitest';
import * as vscode from 'vscode';
import { CancellationToken, TextDocument, extensions } from 'vscode';
import { LWC_JEST_RUNNER_DUPLICATE_LENS_NOTICE_DISMISSED } from '../../../../src/testSupport/types/constants';

// Mock the provideLwcTestCodeLens module
vi.mock('../../../../src/testSupport/codeLens/provideLwcTestCodeLens', () => ({
  provideLwcTestCodeLens: vi.fn()
}));

import { provideLwcTestCodeLens } from '../../../../src/testSupport/codeLens/provideLwcTestCodeLens';
import {
  getLwcTestCodeLensProvider,
  registerLwcTestCodeLensProvider
} from '../../../../src/testSupport/codeLens/lwcTestCodeLensProvider';

describe('LwcTestCodeLensProvider notification logic', () => {
  let mockDocument: TextDocument;
  let mockToken: CancellationToken;
  let mockContext: vscode.ExtensionContext;
  let getExtensionSpy: VitestMockInstance;
  let showInformationMessageSpy: VitestMockInstance;
  let globalStateGet: VitestMock;
  let globalStateUpdate: VitestMock;

  beforeEach(() => {
    mockDocument = {
      uri: {
        fsPath: '/test/path/testFile.test.js'
      },
      getText: vi.fn()
    } as unknown as TextDocument;
    mockToken = {} as CancellationToken;

    // Mock globalState
    globalStateGet = vi.fn();
    globalStateUpdate = vi.fn();
    mockContext = {
      globalState: {
        get: globalStateGet,
        update: globalStateUpdate
      },
      subscriptions: []
    } as unknown as vscode.ExtensionContext;

    // Reset mocks
    (provideLwcTestCodeLens as VitestMock).mockReset();
    getExtensionSpy = vi.spyOn(extensions, 'getExtension');
    showInformationMessageSpy = vi.spyOn(vscode.window, 'showInformationMessage');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show notification when Jest Runner is active, lenses returned, and flag is unset', () => {
    // Mock Jest Runner as active
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return { isActive: true } as unknown as vscode.Extension<unknown>;
      }
      return undefined;
    });

    // Mock globalState flag as unset
    globalStateGet.mockReturnValue(undefined);

    // Mock provideLwcTestCodeLens to return lenses
    const mockCodeLens = { command: { title: 'Run Test (LWC)' }, range: {} };
    (provideLwcTestCodeLens as VitestMock).mockReturnValue([mockCodeLens]);

    // Mock showInformationMessage to return a promise
    showInformationMessageSpy.mockResolvedValue(undefined);

    // Register and get provider
    registerLwcTestCodeLensProvider(mockContext);
    const provider = getLwcTestCodeLensProvider();

    // Call provideCodeLenses
    provider?.provideCodeLenses(mockDocument, mockToken);

    // Notification should be shown
    expect(showInformationMessageSpy).toHaveBeenCalledTimes(1);
    expect(showInformationMessageSpy).toHaveBeenCalledWith(expect.stringContaining('Jest Runner'), "Don't show again");
  });

  it('should NOT show notification when Jest Runner is not active', () => {
    // Mock Jest Runner as not active
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return { isActive: false } as unknown as vscode.Extension<unknown>;
      }
      return undefined;
    });

    globalStateGet.mockReturnValue(undefined);
    const mockCodeLens = { command: { title: 'Run Test (LWC)' }, range: {} };
    (provideLwcTestCodeLens as VitestMock).mockReturnValue([mockCodeLens]);

    registerLwcTestCodeLensProvider(mockContext);
    const provider = getLwcTestCodeLensProvider();
    provider?.provideCodeLenses(mockDocument, mockToken);

    // Notification should NOT be shown
    expect(showInformationMessageSpy).not.toHaveBeenCalled();
  });

  it('should NOT show notification when globalState flag is already set', () => {
    // Mock Jest Runner as active
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return { isActive: true } as unknown as vscode.Extension<unknown>;
      }
      return undefined;
    });

    // Mock globalState flag as already set
    globalStateGet.mockReturnValue(true);

    const mockCodeLens = { command: { title: 'Run Test (LWC)' }, range: {} };
    (provideLwcTestCodeLens as VitestMock).mockReturnValue([mockCodeLens]);

    registerLwcTestCodeLensProvider(mockContext);
    const provider = getLwcTestCodeLensProvider();
    provider?.provideCodeLenses(mockDocument, mockToken);

    // Notification should NOT be shown
    expect(showInformationMessageSpy).not.toHaveBeenCalled();
  });

  it('should NOT show notification when no lenses are returned', () => {
    // Mock Jest Runner as active
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return { isActive: true } as unknown as vscode.Extension<unknown>;
      }
      return undefined;
    });

    globalStateGet.mockReturnValue(undefined);
    // Return empty array - no lenses
    (provideLwcTestCodeLens as VitestMock).mockReturnValue([]);

    registerLwcTestCodeLensProvider(mockContext);
    const provider = getLwcTestCodeLensProvider();
    provider?.provideCodeLenses(mockDocument, mockToken);

    // Notification should NOT be shown when no lenses
    expect(showInformationMessageSpy).not.toHaveBeenCalled();
  });

  it('should update globalState when user clicks "Don\'t show again"', async () => {
    // Mock Jest Runner as active
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return { isActive: true } as unknown as vscode.Extension<unknown>;
      }
      return undefined;
    });

    globalStateGet.mockReturnValue(undefined);

    const mockCodeLens = { command: { title: 'Run Test (LWC)' }, range: {} };
    (provideLwcTestCodeLens as VitestMock).mockReturnValue([mockCodeLens]);

    // Mock showInformationMessage to return the button choice
    const buttonText = "Don't show again";
    showInformationMessageSpy.mockResolvedValue(buttonText);

    registerLwcTestCodeLensProvider(mockContext);
    const provider = getLwcTestCodeLensProvider();
    provider?.provideCodeLenses(mockDocument, mockToken);

    // Wait for async notification handler
    await new Promise(resolve => setTimeout(resolve, 0));

    // Verify globalState.update was called
    expect(globalStateUpdate).toHaveBeenCalledWith(LWC_JEST_RUNNER_DUPLICATE_LENS_NOTICE_DISMISSED, true);
  });

  it('should only show notification once per session', () => {
    // Mock Jest Runner as active
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return { isActive: true } as unknown as vscode.Extension<unknown>;
      }
      return undefined;
    });

    globalStateGet.mockReturnValue(undefined);
    const mockCodeLens = { command: { title: 'Run Test (LWC)' }, range: {} };
    (provideLwcTestCodeLens as VitestMock).mockReturnValue([mockCodeLens]);
    showInformationMessageSpy.mockResolvedValue(undefined);

    registerLwcTestCodeLensProvider(mockContext);
    const provider = getLwcTestCodeLensProvider();

    // Call multiple times
    provider?.provideCodeLenses(mockDocument, mockToken);
    provider?.provideCodeLenses(mockDocument, mockToken);
    provider?.provideCodeLenses(mockDocument, mockToken);

    // Should only show once
    expect(showInformationMessageSpy).toHaveBeenCalledTimes(1);
  });
});
