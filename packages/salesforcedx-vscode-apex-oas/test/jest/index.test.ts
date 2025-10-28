/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

// Mock vscode and other dependencies BEFORE importing the index file
const mockWorkspaceContext = { initialize: jest.fn() };
const mockTelemetryService = {
  initializeService: jest.fn(),
  sendExtensionDeactivationEvent: jest.fn()
};
const mockCoreExports = {
  WorkspaceContext: { getInstance: () => mockWorkspaceContext },
  services: { TelemetryService: { getInstance: () => mockTelemetryService } }
};

// Add registerCommand to vscode.commands if it doesn't exist
if (!vscode.commands.registerCommand) {
  (vscode.commands as any).registerCommand = jest.fn(() => ({ dispose: jest.fn() }));
}

// Add from method to vscode.Disposable if it doesn't exist
if (!(vscode.Disposable as any).from) {
  (vscode.Disposable as any).from = jest.fn((...disposables) => ({
    dispose: () => disposables.forEach((d: any) => d.dispose?.())
  }));
}

jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(() => Promise.resolve());
jest.spyOn(vscode.commands, 'registerCommand').mockImplementation(() => ({ dispose: jest.fn() }) as any);

jest.mock('../../src/telemetry', () => ({
  getTelemetryService: jest.fn(() => mockTelemetryService),
  setTelemetryService: jest.fn()
}));

jest.mock('../../src/commands', () => ({
  createApexActionFromClass: jest.fn(),
  validateOpenApiDocument: jest.fn(),
  ApexActionController: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../src/commands/metadataOrchestrator', () => ({
  MetadataOrchestrator: jest.fn().mockImplementation(() => ({}))
}));

const mockCheckIfESRIsDecomposed = jest.fn().mockResolvedValue(false);

jest.mock('../../src/oasUtils', () => ({
  checkIfESRIsDecomposed: mockCheckIfESRIsDecomposed
}));

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  ActivationTracker: class {
    public markActivationStop = jest.fn();
  },
  WorkspaceContextUtil: {
    getInstance: () => ({
      initialize: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

jest.mock('../../src/coreExtensionUtils', () => ({
  getVscodeCoreExtension: jest.fn()
}));

// Import the activate function and dependencies AFTER mocks are set up
import { getVscodeCoreExtension } from '../../src/coreExtensionUtils';
import { activate } from '../../src/index';

describe('OAS Extension Activation', () => {
  let mockContext: vscode.ExtensionContext;
  let mockEinsteinGptExtension: vscode.Extension<any>;
  let mockVscodeCoreExtension: vscode.Extension<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckIfESRIsDecomposed.mockResolvedValue(false);

    mockContext = {
      subscriptions: [],
      extension: {
        packageJSON: {
          name: 'salesforcedx-vscode-apex-oas'
        }
      }
    } as any;

    mockEinsteinGptExtension = {
      isActive: true,
      id: 'salesforce.salesforcedx-einstein-gpt',
      exports: {},
      activate: jest.fn()
    } as any;

    mockVscodeCoreExtension = {
      isActive: true,
      id: 'salesforce.salesforcedx-vscode-core',
      exports: mockCoreExports,
      activate: jest.fn()
    } as any;
  });

  it('should activate and register commands when Einstein GPT extension is installed and active', async () => {
    (getVscodeCoreExtension as jest.Mock).mockResolvedValue(mockVscodeCoreExtension);

    jest.spyOn(vscode.extensions, 'getExtension').mockImplementation((id: string) => {
      if (id === 'salesforce.salesforcedx-einstein-gpt') {
        return mockEinsteinGptExtension;
      }
      return undefined;
    });

    await activate(mockContext);

    // Verify commands were registered
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sf.create.apex.action.class', expect.any(Function));
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sf.validate.oas.document', expect.any(Function));

    // Verify commands were added to subscriptions
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });

  it('should not register commands when Einstein GPT extension is installed but not active', async () => {
    (getVscodeCoreExtension as jest.Mock).mockResolvedValue(mockVscodeCoreExtension);

    const inactiveEinsteinGptExtension = {
      isActive: false,
      id: 'salesforce.salesforcedx-einstein-gpt',
      exports: {},
      activate: jest.fn()
    } as any;

    jest.spyOn(vscode.extensions, 'getExtension').mockImplementation((id: string) => {
      if (id === 'salesforce.salesforcedx-einstein-gpt') {
        return inactiveEinsteinGptExtension;
      }
      return undefined;
    });

    await activate(mockContext);

    // Verify commands were NOT registered
    expect(vscode.commands.registerCommand).not.toHaveBeenCalledWith(
      'sf.create.apex.action.class',
      expect.any(Function)
    );
    expect(vscode.commands.registerCommand).not.toHaveBeenCalledWith('sf.validate.oas.document', expect.any(Function));
  });

  it('should return early and not activate when Einstein GPT extension is not installed', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(undefined);

    const result = await activate(mockContext);

    expect(result).toEqual({});
    expect(consoleLogSpy).toHaveBeenCalledWith('Einstein GPT extension not found. OAS extension will not activate.');

    // Verify getVscodeCoreExtension was NOT called since we returned early
    expect(getVscodeCoreExtension).not.toHaveBeenCalled();

    // Verify commands were NOT registered
    expect(vscode.commands.registerCommand).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  it('should set context variables correctly when activating', async () => {
    (getVscodeCoreExtension as jest.Mock).mockResolvedValue(mockVscodeCoreExtension);

    jest.spyOn(vscode.extensions, 'getExtension').mockImplementation((id: string) => {
      if (id === 'salesforce.salesforcedx-einstein-gpt') {
        return mockEinsteinGptExtension;
      }
      if (id === 'salesforce.mule-dx-agentforce-api-component') {
        return undefined;
      }
      return undefined;
    });

    await activate(mockContext);

    // Verify context was set for ESR decomposition
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:is_esr_decomposed', false);

    // Verify context was set for Mule extension
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:muleDxApiInactive', true);
  });
});
