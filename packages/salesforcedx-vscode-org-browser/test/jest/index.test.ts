/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { Effect, Context, Layer } from 'effect';
import { activateEffect, deactivateEffect } from '../../src/index';
import { ExtensionProviderService } from '../../src/services/extensionProvider';
import { ConnectionService, ConnectionServiceLive } from 'salesforcedx-vscode-services/src/core/connectionService';
import { ProjectService, ProjectServiceLive } from 'salesforcedx-vscode-services/src/core/projectService';

// 1. Full OutputChannel mock
const mockAppendLine = jest.fn();
const mockOutputChannel: vscode.OutputChannel = {
  name: 'mock',
  append: jest.fn(),
  appendLine: mockAppendLine,
  replace: jest.fn(),
  clear: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  dispose: jest.fn()
};

// 2. ChannelService mock
const mockChannelService = {
  getChannel: Effect.sync(() => mockOutputChannel),
  appendToChannel: (message: string): Effect.Effect<void> => Effect.sync(() => mockAppendLine(message))
};
const MockChannelService = Context.GenericTag<typeof mockChannelService>('ChannelService');
const MockChannelServiceLayer = (_: string): Layer.Layer<typeof mockChannelService> =>
  Layer.effect(
    MockChannelService,
    Effect.sync(() => mockChannelService)
  );

// 3. ExtensionProviderService mock
const MockExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi: Effect.sync(() => ({
      services: {
        ConnectionService: {} as typeof ConnectionService,
        ConnectionServiceLive: {} as typeof ConnectionServiceLive,
        ProjectService: {} as typeof ProjectService,
        ProjectServiceLive: {} as typeof ProjectServiceLive,
        ChannelService: MockChannelService,
        ChannelServiceLayer: MockChannelServiceLayer
      }
    }))
  }))
);

describe('Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should activate successfully', async () => {
    await Effect.runPromise(Effect.provide(activateEffect, MockExtensionProviderServiceLive));
    expect(mockAppendLine).toHaveBeenCalledWith('Salesforce Org Browser extension is now active!');
  });

  it('should deactivate successfully', async () => {
    await Effect.runPromise(Effect.provide(deactivateEffect, MockExtensionProviderServiceLive));
    expect(mockAppendLine).toHaveBeenCalledWith('Salesforce Org Browser extension is now deactivated!');
  });
});
