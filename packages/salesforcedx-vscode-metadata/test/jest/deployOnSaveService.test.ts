/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { shouldDeploy } from '../../src/services/deployOnSaveService';
import { ExtensionProviderService } from '../../src/services/extensionProvider';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';

const mockAppendToChannel = jest.fn();

const createMockChannelService = (): ChannelService =>
  new ChannelService({
    getChannel: Effect.sync(
      () =>
        ({
          appendLine: mockAppendToChannel
        }) as unknown as vscode.OutputChannel
    ),
    appendToChannel: (message: string) => Effect.sync(() => mockAppendToChannel(message))
  });

const createMockWorkspaceService = (workspacePath: string, isVirtualFs = false): WorkspaceService => {
  const fsPath = workspacePath.startsWith('memfs:')
    ? workspacePath.replace('memfs:', '')
    : workspacePath.replace('file://', '');
  return new WorkspaceService({
    getWorkspaceInfo: Effect.succeed({
      path: workspacePath,
      fsPath,
      isEmpty: false,
      isVirtualFs,
      cwd: fsPath
    }),
    getWorkspaceInfoOrThrow: Effect.succeed({
      path: workspacePath,
      fsPath,
      isEmpty: false,
      isVirtualFs,
      cwd: fsPath,
      workspaceFolder: {
        uri: { fsPath },
        name: 'workspace',
        index: 0
      }
    })
  });
};

const createMockExtensionProvider = (): ExtensionProviderService => ({
  getServicesApi: Effect.sync(
    () =>
      ({
        services: {
          ChannelService,
          WorkspaceService
        }
      }) as unknown as SalesforceVSCodeServicesApi
  )
});

describe('shouldDeploy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('file filesystem', () => {
    it('should return true for valid metadata file in workspace', async () => {
      const workspacePath = 'file:///workspace';
      const uri = URI.file('/workspace/classes/Test.cls');
      const mockChannelService = createMockChannelService();
      const mockWorkspaceService = createMockWorkspaceService(workspacePath);
      const mockExtensionProvider = createMockExtensionProvider();

      const result = await Effect.runPromise(
        shouldDeploy(uri).pipe(
          Effect.provideService(ChannelService, mockChannelService),
          Effect.provideService(WorkspaceService, mockWorkspaceService),
          Effect.provideService(ExtensionProviderService, mockExtensionProvider)
        )
      );

      expect(result).toBe(true);
    });

    it('should return false for file outside workspace', async () => {
      const workspacePath = 'file:///workspace';
      const uri = URI.file('/other/classes/Test.cls');
      const mockChannelService = createMockChannelService();
      const mockWorkspaceService = createMockWorkspaceService(workspacePath);
      const mockExtensionProvider = createMockExtensionProvider();

      const result = await Effect.runPromise(
        shouldDeploy(uri).pipe(
          Effect.provideService(ChannelService, mockChannelService),
          Effect.provideService(WorkspaceService, mockWorkspaceService),
          Effect.provideService(ExtensionProviderService, mockExtensionProvider)
        )
      );

      expect(result).toBe(false);
    });

    it('should return false for dot files', async () => {
      const workspacePath = 'file:///workspace';
      const uri = URI.file('/workspace/.hidden');
      const mockChannelService = createMockChannelService();
      const mockWorkspaceService = createMockWorkspaceService(workspacePath);
      const mockExtensionProvider = createMockExtensionProvider();

      const result = await Effect.runPromise(
        shouldDeploy(uri).pipe(
          Effect.provideService(ChannelService, mockChannelService),
          Effect.provideService(WorkspaceService, mockWorkspaceService),
          Effect.provideService(ExtensionProviderService, mockExtensionProvider)
        )
      );

      expect(result).toBe(false);
    });

    it('should return false for .soql files', async () => {
      const workspacePath = 'file:///workspace';
      const uri = URI.file('/workspace/queries/test.soql');
      const mockChannelService = createMockChannelService();
      const mockWorkspaceService = createMockWorkspaceService(workspacePath);
      const mockExtensionProvider = createMockExtensionProvider();

      const result = await Effect.runPromise(
        shouldDeploy(uri).pipe(
          Effect.provideService(ChannelService, mockChannelService),
          Effect.provideService(WorkspaceService, mockWorkspaceService),
          Effect.provideService(ExtensionProviderService, mockExtensionProvider)
        )
      );

      expect(result).toBe(false);
    });

    it('should return false for .apex files', async () => {
      const workspacePath = 'file:///workspace';
      const uri = URI.file('/workspace/test.apex');
      const mockChannelService = createMockChannelService();
      const mockWorkspaceService = createMockWorkspaceService(workspacePath);
      const mockExtensionProvider = createMockExtensionProvider();

      const result = await Effect.runPromise(
        shouldDeploy(uri).pipe(
          Effect.provideService(ChannelService, mockChannelService),
          Effect.provideService(WorkspaceService, mockWorkspaceService),
          Effect.provideService(ExtensionProviderService, mockExtensionProvider)
        )
      );

      expect(result).toBe(false);
    });
  });

  describe('virtual filesystem (memfs)', () => {
    it('should return true for valid metadata file in memfs workspace', async () => {
      const workspacePath = 'memfs:/MyProject';
      const uri = URI.parse('memfs:/MyProject/force-app/main/default/classes/FileUtilities.cls');
      const mockChannelService = createMockChannelService();
      const mockWorkspaceService = createMockWorkspaceService(workspacePath, true);
      const mockExtensionProvider = createMockExtensionProvider();

      const result = await Effect.runPromise(
        shouldDeploy(uri).pipe(
          Effect.provideService(ChannelService, mockChannelService),
          Effect.provideService(WorkspaceService, mockWorkspaceService),
          Effect.provideService(ExtensionProviderService, mockExtensionProvider)
        )
      );

      expect(result).toBe(true);
    });

    it('should return false for file outside memfs workspace', async () => {
      const workspacePath = 'memfs:/MyProject';
      const uri = URI.parse('memfs:/OtherProject/force-app/main/default/classes/Test.cls');
      const mockChannelService = createMockChannelService();
      const mockWorkspaceService = createMockWorkspaceService(workspacePath, true);
      const mockExtensionProvider = createMockExtensionProvider();

      const result = await Effect.runPromise(
        shouldDeploy(uri).pipe(
          Effect.provideService(ChannelService, mockChannelService),
          Effect.provideService(WorkspaceService, mockWorkspaceService),
          Effect.provideService(ExtensionProviderService, mockExtensionProvider)
        )
      );

      expect(result).toBe(false);
    });

    it('should return false for .soql files in memfs workspace', async () => {
      const workspacePath = 'memfs:/MyProject';
      const uri = URI.parse('memfs:/MyProject/force-app/main/default/queries/test.soql');
      const mockChannelService = createMockChannelService();
      const mockWorkspaceService = createMockWorkspaceService(workspacePath, true);
      const mockExtensionProvider = createMockExtensionProvider();

      const result = await Effect.runPromise(
        shouldDeploy(uri).pipe(
          Effect.provideService(ChannelService, mockChannelService),
          Effect.provideService(WorkspaceService, mockWorkspaceService),
          Effect.provideService(ExtensionProviderService, mockExtensionProvider)
        )
      );

      expect(result).toBe(false);
    });
  });
});
