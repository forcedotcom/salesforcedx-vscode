/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import { breakpointUtil } from '@salesforce/salesforcedx-apex-replay-debugger';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  ConnectionService,
  FailedToCreateConnectionError
} from 'salesforcedx-vscode-services/src/core/connectionService';
import { QueryService } from 'salesforcedx-vscode-services/src/core/queryService';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services/src/core/schemas/defaultOrgInfo';
import { NotificationModeService } from 'salesforcedx-vscode-services/src/vscode/notificationModeService';
import * as vscode from 'vscode';
import { retrieveLineBreakpointInfo } from '../../../src/apexExtension';
import { checkpointService, sfCreateCheckpointsCommand } from '../../../src/breakpoints/checkpointService';
import { writeToDebuggerOutputWindow } from '../../../src/channels';
import { FIELD_INTEGRITY_EXCEPTION } from '../../../src/debuggerConstants';
import { nls } from '../../../src/messages';
import { setAllServicesLayer } from '../../../src/services/extensionProvider';
import { disposeRuntime, getRuntime } from '../../../src/services/runtime';

vi.mock('../../../src/apexExtension', () => ({ retrieveLineBreakpointInfo: vi.fn() }));
vi.mock('../../../src/channels', () => ({ writeToDebuggerOutputWindow: vi.fn() }));

describe('checkpoint upload Effects', () => {
  const userId = '005000000000001';
  const checkpointUri = 'file:///project/classes/Example.cls';
  const progress = { report: vi.fn<vscode.Progress<{ increment?: number; message?: string }>['report']>() };
  const query = vi.fn();
  const queryMore = vi.fn();
  const deleteCheckpoint = vi.fn();
  const createCheckpoint = vi.fn();
  const sobject = vi.fn();
  const connection = { tooling: { query, queryMore, sobject } } as unknown as Connection;
  const getConnection = vi.fn<ConnectionService['getConnection']>();
  let targetOrgRef: SubscriptionRef.SubscriptionRef<typeof DefaultOrgInfoSchema.Type>;
  let queryService: Effect.Effect<QueryService, FailedToCreateConnectionError, QueryService>;

  const addCheckpoint = (id = 'checkpoint', enabled = true, line = 7) =>
    checkpointService.createCheckpointNode(id, enabled, checkpointUri, 'Example.cls', {
      ActionScript: '',
      ActionScriptType: 'None',
      ExecutableEntityName: undefined,
      IsDumpingHeap: true,
      Iteration: 1,
      Line: line
    });

  const upload = () => getRuntime().runPromise(sfCreateCheckpointsCommand());
  const expectError = (message: string) => {
    expect(writeToDebuggerOutputWindow).toHaveBeenCalledWith(message, 'error');
    expect(writeToDebuggerOutputWindow).toHaveBeenCalledWith(
      nls.localize('checkpoint_upload_error_wrap_up_message', nls.localize('sf_update_checkpoints_in_org')),
      'error'
    );
    expect(progress.report).not.toHaveBeenCalledWith(expect.objectContaining({ increment: 100 }));
    expect(writeToDebuggerOutputWindow).toHaveBeenCalledWith(
      `${nls.localize('long_command_end')} ${nls.localize('sf_update_checkpoints_in_org')}`
    );
  };

  beforeEach(async () => {
    targetOrgRef = await Effect.runPromise(SubscriptionRef.make<typeof DefaultOrgInfoSchema.Type>({ userId }));
    queryService = QueryService;
    getConnection.mockImplementation(() => Effect.succeed(connection));
    query.mockResolvedValue({ totalSize: 0, done: true, records: [] });
    deleteCheckpoint.mockResolvedValue({ success: true });
    createCheckpoint.mockResolvedValue({ success: true, id: 'overlay-id' });
    sobject.mockReturnValue({ delete: deleteCheckpoint, create: createCheckpoint });
    vi.mocked(retrieveLineBreakpointInfo).mockReturnValue(Effect.succeed(true));
    vi.spyOn(breakpointUtil, 'canSetLineBreakpoint').mockReturnValue(true);
    vi.spyOn(breakpointUtil, 'getTopLevelTyperefForUri').mockReturnValue('Example');
    vi.mocked(vscode.window.withProgress).mockImplementation(async (_options, task) =>
      task(progress, new vscode.CancellationTokenSource().token)
    );

    const connectionLayer = Layer.succeed(ConnectionService, { getConnection } as unknown as ConnectionService);
    const servicesApi = {
      services: {
        ConnectionService,
        get QueryService() {
          return queryService;
        },
        NotificationModeService,
        TargetOrgRef: () => Effect.succeed(targetOrgRef)
      }
    } as unknown as SalesforceVSCodeServicesApi;
    setAllServicesLayer(
      Layer.mergeAll(
        Layer.succeed(ExtensionProviderService, { getServicesApi: Effect.succeed(servicesApi) }),
        connectionLayer,
        QueryService.DefaultWithoutDependencies.pipe(Layer.provide(connectionLayer)),
        Layer.succeed(NotificationModeService, {
          getProgressLocation: () => Effect.succeed(vscode.ProgressLocation.Notification)
        } as unknown as NotificationModeService)
      ) as unknown as Parameters<typeof setAllServicesLayer>[0]
    );
  });

  afterEach(async () => {
    checkpointService
      .getChildren()
      .map(node => (node as ReturnType<typeof addCheckpoint>).breakpointId)
      .forEach(id => checkpointService.deleteCheckpointNodeIfExists(id));
    vi.restoreAllMocks();
    await disposeRuntime();
  });

  it('queries the active user, deletes every page, then creates only enabled checkpoints', async () => {
    const node = addCheckpoint();
    const disabledNode = addCheckpoint('disabled', false);
    query.mockResolvedValue({
      totalSize: 2,
      done: false,
      records: [{ Id: 'old-1' }],
      nextRecordsUrl: '/next-page'
    });
    queryMore.mockResolvedValue({ totalSize: 2, done: true, records: [{ Id: 'old-2' }] });

    expect(await upload()).toBe(true);

    expect(query).toHaveBeenCalledWith(`SELECT Id FROM ApexExecutionOverlayAction WHERE ScopeId = '${userId}'`, {
      scanAll: false
    });
    expect(queryMore).toHaveBeenCalledWith('/next-page');
    expect(deleteCheckpoint.mock.calls).toEqual([['old-1'], ['old-2']]);
    expect(sobject.mock.calls.every(([name]) => name === 'ApexExecutionOverlayAction')).toBe(true);
    expect(createCheckpoint).toHaveBeenCalledExactlyOnceWith({
      ActionScript: '',
      ActionScriptType: 'None',
      ExecutableEntityName: 'Example',
      IsDumpingHeap: true,
      Iteration: 1,
      Line: 7
    });
    expect(deleteCheckpoint.mock.invocationCallOrder[1]).toBeLessThan(createCheckpoint.mock.invocationCallOrder[0]);
    expect(node.getActionCommandResultId()).toBe('overlay-id');
    expect(disabledNode.getActionCommandResultId()).toBeUndefined();
    expect(vscode.window.withProgress).toHaveBeenCalledWith(
      {
        location: vscode.ProgressLocation.Notification,
        title: nls.localize('sf_update_checkpoints_in_org'),
        cancellable: false
      },
      expect.any(Function)
    );
    expect(progress.report.mock.calls.map(([step]) => step.increment)).toEqual([0, 20, 50, 50, 70, 100]);
    expect(writeToDebuggerOutputWindow).toHaveBeenCalledWith(
      `${nls.localize('sf_update_checkpoints_in_org')}, ${nls.localize('checkpoint_creation_status_processing_complete_success')}`
    );
  });

  it('creates checkpoints when the existing-checkpoint query is empty and accepts an array SaveResult', async () => {
    const node = addCheckpoint();
    createCheckpoint.mockResolvedValue([{ success: true, id: 'array-overlay-id' }]);

    expect(await upload()).toBe(true);
    expect(deleteCheckpoint).not.toHaveBeenCalled();
    expect(node.getActionCommandResultId()).toBe('array-overlay-id');
  });

  it.each([
    { stage: 'initial org check', successfulConnections: 0 },
    { stage: 'clearing checkpoints', successfulConnections: 1 },
    { stage: 'creating a checkpoint', successfulConnections: 3 }
  ])('reports connection failure during $stage', async ({ successfulConnections }) => {
    const node = addCheckpoint();
    Array.from({ length: successfulConnections }).forEach(() =>
      getConnection.mockReturnValueOnce(Effect.succeed(connection))
    );
    getConnection.mockReturnValueOnce(Effect.fail(new FailedToCreateConnectionError({ message: 'connection failed' })));

    expect(await upload()).toBe(false);
    expectError(`${nls.localize('unable_to_retrieve_org_info')} : connection failed`);
    expect(createCheckpoint).not.toHaveBeenCalled();
    expect(node.getActionCommandResultId()).toBeUndefined();
    if (successfulConnections === 0) expect(retrieveLineBreakpointInfo).not.toHaveBeenCalled();
  });

  it('does not query or create without an active user', async () => {
    addCheckpoint();
    await Effect.runPromise(SubscriptionRef.set(targetOrgRef, {}));

    expect(await upload()).toBe(false);
    expectError(nls.localize('unable_to_retrieve_active_user_for_sf_project'));
    expect(query).not.toHaveBeenCalled();
    expect(createCheckpoint).not.toHaveBeenCalled();
  });

  it('reports QueryService acquisition failure without deleting or creating', async () => {
    addCheckpoint();
    const error = new FailedToCreateConnectionError({ message: 'query service unavailable' });
    queryService = Effect.fail(error);

    expect(await upload()).toBe(false);
    expectError(`${nls.localize('unable_to_query_for_existing_checkpoints')} : ${String(error)}`);
    expect(query).not.toHaveBeenCalled();
    expect(deleteCheckpoint).not.toHaveBeenCalled();
    expect(createCheckpoint).not.toHaveBeenCalled();
  });

  it.each(['first page', 'later page'])(
    'reports a query failure on the %s without deleting or creating',
    async page => {
      addCheckpoint();
      if (page === 'first page') {
        query.mockRejectedValue(new Error('query failed'));
      } else {
        query.mockResolvedValue({
          totalSize: 2,
          done: false,
          records: [{ Id: 'old-1' }],
          nextRecordsUrl: '/next-page'
        });
        queryMore.mockRejectedValue(new Error('query failed'));
      }

      expect(await upload()).toBe(false);
      expect(writeToDebuggerOutputWindow).toHaveBeenCalledWith(
        expect.stringContaining(nls.localize('unable_to_query_for_existing_checkpoints')),
        'error'
      );
      expect(deleteCheckpoint).not.toHaveBeenCalled();
      expect(createCheckpoint).not.toHaveBeenCalled();
    }
  );

  it('waits for all deletes after a rejection and does not create new checkpoints', async () => {
    addCheckpoint();
    query.mockResolvedValue({ totalSize: 2, done: true, records: [{ Id: 'old-1' }, { Id: 'old-2' }] });
    const { promise, resolve } = Promise.withResolvers<{ success: boolean }>();
    const { promise: secondDeleteStarted, resolve: started } = Promise.withResolvers<void>();
    deleteCheckpoint.mockRejectedValueOnce(new Error('delete failed')).mockImplementationOnce(() => {
      started();
      return promise;
    });
    const result = upload();
    await secondDeleteStarted;
    expect(writeToDebuggerOutputWindow).not.toHaveBeenCalledWith(
      nls.localize('cannot_delete_existing_checkpoint'),
      'error'
    );
    resolve({ success: true });

    expect(await result).toBe(false);
    expect(deleteCheckpoint.mock.calls).toEqual([['old-1'], ['old-2']]);
    expectError(nls.localize('cannot_delete_existing_checkpoint'));
    expect(createCheckpoint).not.toHaveBeenCalled();
  });

  it.each([{ result: [] }, { result: { success: false, errors: [] } }, { result: { success: true } }])(
    'reports an empty, unsuccessful, or ID-less SaveResult: $result',
    async ({ result }) => {
      const node = addCheckpoint();
      createCheckpoint.mockResolvedValue(result);

      expect(await upload()).toBe(false);
      expectError(`Failed to create checkpoint. URI=${checkpointUri}, Line=7`);
      expect(node.getActionCommandResultId()).toBeUndefined();
    }
  );

  it.each([
    {
      error: { body: [{ message: 'out of sync', errorCode: FIELD_INTEGRITY_EXCEPTION }] },
      message: nls.localize('local_source_is_out_of_sync_with_the_server')
    },
    {
      error: { body: [{ message: 'server rejected checkpoint', errorCode: 'OTHER_ERROR' }] },
      message: `server rejected checkpoint. URI=${checkpointUri}, Line=7`
    },
    { error: new Error('request failed'), message: `Error: request failed. URI=${checkpointUri}, Line=7` },
    { error: undefined, message: `undefined. URI=${checkpointUri}, Line=7` }
  ])('preserves create failure output: $message', async ({ error, message }) => {
    const failedNode = addCheckpoint();
    const successfulNode = addCheckpoint('second-checkpoint', true, 9);
    createCheckpoint.mockRejectedValueOnce(error);

    expect(await upload()).toBe(false);
    expectError(message);
    expect(createCheckpoint).toHaveBeenCalledTimes(2);
    expect(failedNode.getActionCommandResultId()).toBeUndefined();
    expect(successfulNode.getActionCommandResultId()).toBe('overlay-id');
  });
});
