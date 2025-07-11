/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { activate, deactivate } from '../../src/index';
import * as vscode from 'vscode';

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
    } as unknown as vscode.ExtensionContext;

    const api = await activate(context);
    expect(api).toBeDefined();
    expect(api.telemetryService).toBeDefined();
    expect(api.services).toBeDefined();
    expect(api.services.ConnectionService).toBeDefined();
    expect(api.services.ConnectionServiceLive).toBeDefined();
    expect(api.services.ProjectService).toBeDefined();
    expect(api.services.ProjectServiceLive).toBeDefined();
  });

  it('should deactivate successfully', () => {
    deactivate();
    expect(true).toBe(true);
  });
});
