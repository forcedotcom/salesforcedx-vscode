/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

const mockWorkspaceContext = { initialize: jest.fn().mockResolvedValue(undefined) };
const mockTelemetryService = {
  initializeService: jest.fn(),
  sendExtensionDeactivationEvent: jest.fn()
};
const mockCoreExports = {
  WorkspaceContext: { getInstance: () => mockWorkspaceContext },
  services: { TelemetryService: { getInstance: () => mockTelemetryService } }
};

if (!vscode.commands.registerCommand) {
  (vscode.commands as any).registerCommand = jest.fn(() => ({ dispose: jest.fn() }));
}

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

jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  WorkspaceContextUtil: {
    getInstance: () => ({
      initialize: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

jest.mock('../../src/services/extensionProvider', () => ({
  buildAllServicesLayer: () => ({}),
  setAllServicesLayer: () => {}
}));

jest.mock('../../src/services/runtime', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  getRuntime: () => ({ runPromise: (eff: any) => require('effect/Effect').runPromise(eff) })
}));

jest.mock('../../src/coreExtensionUtils', () => ({
  getVscodeCoreExtension: jest.fn()
}));

import { getVscodeCoreExtension } from '../../src/coreExtensionUtils';
import { activate, apexActionController } from '../../src/index';

describe('OAS Extension Activation', () => {
  let mockContext: vscode.ExtensionContext;
  let mockVscodeCoreExtension: vscode.Extension<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(() => Promise.resolve());
    mockWorkspaceContext.initialize.mockResolvedValue(undefined);
    (apexActionController.initialize as jest.Mock).mockResolvedValue(undefined);

    mockContext = {
      subscriptions: [],
      extension: {
        packageJSON: {
          name: 'salesforcedx-vscode-apex-oas'
        }
      }
    } as any;

    mockVscodeCoreExtension = {
      isActive: true,
      id: 'salesforce.salesforcedx-vscode-core',
      exports: mockCoreExports,
      activate: jest.fn()
    } as any;
  });

  it('registers commands on activation', async () => {
    (getVscodeCoreExtension as jest.Mock).mockResolvedValue(mockVscodeCoreExtension);

    await activate(mockContext);

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sf.create.apex.action.class', expect.any(Function));
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sf.validate.oas.document', expect.any(Function));
    expect(mockContext.subscriptions.length).toBeGreaterThan(0);
  });
});
