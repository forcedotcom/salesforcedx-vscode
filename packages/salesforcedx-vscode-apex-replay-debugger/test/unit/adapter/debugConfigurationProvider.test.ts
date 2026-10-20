/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type { OrgMetadataCatalogComponentEntry } from 'salesforcedx-vscode-services';
import { OrgMetadataCatalog } from 'salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalog';
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { DebugConfigurationProvider } from '../../../src/adapter/debugConfigurationProvider';
import { LAST_OPENED_LOG_FOLDER_KEY, LAST_OPENED_LOG_KEY } from '../../../src/debuggerConstants';
import { type buildAllServicesLayer, setAllServicesLayer } from '../../../src/services/extensionProvider';
import { disposeRuntime } from '../../../src/services/runtime';

describe('DebugConfigurationProvider log-file prompt', () => {
  const readFile = vi.fn();
  const getEntries = vi.fn();
  const workspaceStateUpdate = vi.fn();
  const extensionContext = {
    workspaceState: { update: workspaceStateUpdate }
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    readFile.mockReturnValue(Effect.succeed('64.0 APEX_CODE,FINEST\n12:00:00.0|USER_INFO|[EXTERNAL]|005'));
    workspaceStateUpdate.mockResolvedValue(undefined);
    getEntries.mockReturnValue(Effect.succeed([]));
    (vscode.window as unknown as { showOpenDialog: VitestMock }).showOpenDialog = vi.fn();
    (vscode.window.showErrorMessage as VitestMock).mockResolvedValue(undefined);
    (vscode.extensions.getExtension as VitestMock).mockReturnValue(undefined);
    setAllServicesLayer(
      Layer.mergeAll(
        Layer.succeed(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: {
              FsService: { readFile },
              OrgMetadataCatalog,
              UserCancellationError,
              WorkspaceService: { getWorkspaceInfo: () => Effect.succeed({ isEmpty: true }) }
            }
          })
        } as unknown as ExtensionProviderService),
        Layer.succeed(OrgMetadataCatalog, { getEntries } as unknown as OrgMetadataCatalog)
      ) as ReturnType<typeof buildAllServicesLayer>
    );
  });

  afterEach(disposeRuntime);

  it('reads and remembers the selected log file', async () => {
    const selectedLog = URI.file('/logs/selected.log');
    (vscode.window.showOpenDialog as VitestMock).mockResolvedValue([selectedLog]);

    const resolved = await new DebugConfigurationProvider(extensionContext).resolveDebugConfiguration(undefined, {
      name: 'Prompt for log',
      type: 'apex-replay',
      request: 'launch',
      logFile: '${command:AskForLogFileName}'
    });

    expect(resolved).toMatchObject({
      logFileContents: '64.0 APEX_CODE,FINEST\n12:00:00.0|USER_INFO|[EXTERNAL]|005',
      logFilePath: selectedLog.fsPath,
      logFileName: 'selected.log'
    });
    expect(resolved).not.toHaveProperty('logFile');
    expect(workspaceStateUpdate).toHaveBeenCalledWith(LAST_OPENED_LOG_KEY, selectedLog.fsPath);
    expect(workspaceStateUpdate).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY, URI.file('/logs').fsPath);
  });

  it('silently cancels when no log file is selected', async () => {
    (vscode.window.showOpenDialog as VitestMock).mockResolvedValue(undefined);

    const resolved = await new DebugConfigurationProvider(extensionContext).resolveDebugConfiguration(undefined, {
      name: 'Prompt for log',
      type: 'apex-replay',
      request: 'launch',
      logFile: '${command:AskForLogFileName}'
    });

    expect(resolved).toBeUndefined();
    expect(readFile).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('attaches catalog source URIs from the selected log before returning the launch configuration', async () => {
    (vscode.window.showOpenDialog as VitestMock).mockResolvedValue([URI.file('/logs/selected.log')]);
    readFile.mockReturnValue(Effect.succeed('time|METHOD_ENTRY|[1]|01p|Remote.run()'));
    const entry: OrgMetadataCatalogComponentEntry = {
      kind: 'component',
      reference: { type: 'ApexClass', fullName: 'Remote' },
      orgId: '00D000000000001',
      observedAt: '2026-10-20T00:00:00.000Z',
      provenance: 'metadata-api',
      name: 'Remote',
      documentUri: URI.parse('sf-org-metadata:/orgs/00D000000000001/ApexClass/Remote.cls'),
      inOrg: true,
      inWorkspace: false
    };
    getEntries.mockReturnValue(Effect.succeed([entry]));

    const resolved = await new DebugConfigurationProvider(extensionContext).resolveDebugConfiguration(undefined, {
      name: 'Prompt for log',
      type: 'apex-replay',
      request: 'launch'
    });

    expect(getEntries).toHaveBeenCalledExactlyOnceWith([{ type: 'ApexClass', fullName: 'Remote' }]);
    expect(resolved?.sourceUriMapping).toEqual({ Remote: entry.documentUri.toString() });
    expect(resolved?.lineBreakpointInfo).toBeUndefined();
  });
});
