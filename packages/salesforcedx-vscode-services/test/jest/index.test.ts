/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { activate, deactivate } from '../../src/index';
import { ChannelService } from '../../src/vscode/channelService';
import { Layer, Effect as EffectFn } from 'effect';
import type { Effect } from 'effect/Effect';

// Create a mock ChannelService
const mockChannelService = {
  getChannel: EffectFn.sync(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
    name: 'mock',
    replace: jest.fn(),
    logLevel: 0,
    onDidChangeLogLevel: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  appendToChannel: (_message: string): Effect<void, never, never> => EffectFn.sync(() => {})
};

const MockChannelServiceLayer = Layer.succeed(ChannelService, mockChannelService);

describe('Extension', () => {
  it('should activate successfully', async () => {
    const context = {
      subscriptions: [],
      extension: {
        packageJSON: {
          name: 'test-extension',
          version: '1.0.0',
          aiKey: 'test-key',
          o11yUploadEndpoint: 'test-endpoint',
          enableO11y: 'false'
        }
      },
      globalState: {
        get: jest.fn().mockReturnValue(undefined),
        update: jest.fn()
      }
    } as unknown as import('vscode').ExtensionContext;

    // Provide the mock ChannelService layer for activation
    const api = await activate(context, MockChannelServiceLayer);
    expect(api).toBeDefined();
    expect(api.services).toBeDefined();
    expect(api.services.ConnectionService).toBeDefined();
    expect(api.services.ProjectService).toBeDefined();
  });

  it('should deactivate successfully', () => {
    deactivate();
    expect(true).toBe(true);
  });
});
