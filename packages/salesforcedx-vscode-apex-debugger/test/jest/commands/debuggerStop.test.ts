/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import * as effectExtUtils from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { NotificationModeService } from 'salesforcedx-vscode-services/src/vscode/notificationModeService';
import * as vscode from 'vscode';
import { debuggerStop, DebuggerSessionQueryError } from '../../../src/commands/debuggerStop';

jest.mock('@salesforce/core', () => ({
  AuthInfo: { create: jest.fn() },
  Connection: { create: jest.fn() }
}));

type QueryResult = { records: { Id: string }[] };

const getProgressLocation = jest.fn(() => Effect.succeed(15 /* vscode.ProgressLocation.Notification */));
const showSuccessNotification = jest.fn(() => Effect.void);
const notificationMode = {
  getProgressLocation,
  showSuccessNotification,
  runDispose: jest.fn()
} as unknown as NotificationModeService;

// Fake jsforce Connection: `tooling.query` returns the seeded records; `tooling.sobject(...).update` is a spy.
const makeConnection = (queryImpl: () => Promise<QueryResult>) => {
  const update = jest.fn(() => Promise.resolve({ success: true }));
  const sobject = jest.fn(() => ({ update }));
  return { conn: { tooling: { query: queryImpl, sobject } }, update, sobject };
};

const makeConfigService = (isvSid?: string, isvUrl?: string) => ({
  getConfigAggregator: () =>
    Effect.succeed({
      getPropertyValue: (key: string) => (key.includes('sid') ? isvSid : key.includes('url') ? isvUrl : undefined)
    })
});

// Provide the real effectExtUtils.ExtensionProviderService tag with a mock services api.
const providerLayer = (conn: unknown, isvSid?: string, isvUrl?: string) =>
  Layer.mergeAll(
    Layer.succeed(effectExtUtils.ExtensionProviderService, {
      getServicesApi: Effect.succeed({
        services: {
          ProjectService: { getSfProject: () => Effect.void },
          ConfigService: makeConfigService(isvSid, isvUrl),
          ConnectionService: { getConnection: () => Effect.succeed(conn) },
          // withProgress is a pipeable operator; the mock passes the wrapped effect through unchanged.
          PromptService: Effect.succeed({
            withProgress:
              () =>
              <A, E, R>(self: Effect.Effect<A, E, R>) =>
                self
          }),
          NotificationModeService
        }
      })
    } as unknown as effectExtUtils.ExtensionProviderService),
    Layer.succeed(NotificationModeService, notificationMode)
  );

// providerLayer satisfies ConnectionService/ChannelService at runtime, but the api's typed accessors re-add
// them to the effect's R channel; cast R away since the layer fully provides them.
const run = (conn: unknown, isvSid?: string, isvUrl?: string) =>
  Effect.runPromise(
    debuggerStop().pipe(Effect.provide(providerLayer(conn, isvSid, isvUrl))) as Effect.Effect<void, unknown, never>
  );

const runFlipped = (conn: unknown) =>
  Effect.runPromise(
    debuggerStop().pipe(Effect.provide(providerLayer(conn)), Effect.flip) as Effect.Effect<unknown, never, never>
  );

describe('debuggerStop', () => {
  beforeEach(() => {
    (vscode.window.showInformationMessage as jest.Mock) = jest.fn();
    getProgressLocation.mockReturnValue(Effect.succeed(15 /* vscode.ProgressLocation.Notification */));
    showSuccessNotification.mockReturnValue(Effect.void);
  });

  it('shows "none found" and does NOT update when the query returns 0 records', async () => {
    const { conn, update } = makeConnection(() => Promise.resolve({ records: [] }));
    await run(conn);
    expect(update).not.toHaveBeenCalled();
    expect(showSuccessNotification).toHaveBeenCalledWith(
      'SFDX: Stop Apex Debugger Session',
      'No Apex Debugger session found.',
      false
    );
  });

  it('detaches the session and shows the success toast when the query returns a record', async () => {
    const { conn, sobject, update } = makeConnection(() => Promise.resolve({ records: [{ Id: '07aXX0000000001' }] }));
    await run(conn);
    expect(sobject).toHaveBeenCalledWith('ApexDebuggerSession');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ Id: '07aXX0000000001', Status: 'Detach' });
    expect(showSuccessNotification).toHaveBeenCalledWith(
      'SFDX: Stop Apex Debugger Session',
      'Apex Debugger session stopped.',
      false
    );
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalledWith('Apex Debugger session stopped.');
  });

  it('surfaces a DebuggerSessionQueryError (not swallowed) when the query rejects', async () => {
    const { conn, update } = makeConnection(() => Promise.reject(new Error('boom')));
    const error = await runFlipped(conn);
    expect(error).toBeInstanceOf(DebuggerSessionQueryError);
    expect(update).not.toHaveBeenCalled();
  });

  it('builds an ISV connection from org-isv-debugger-sid/url when present instead of using target-org', async () => {
    const { conn, sobject, update } = makeConnection(() => Promise.resolve({ records: [{ Id: '07aXX0000000002' }] }));
    const mockAuthInfo = {};
    (AuthInfo.create as jest.Mock).mockResolvedValue(mockAuthInfo);
    (Connection.create as jest.Mock).mockResolvedValue(conn);

    await run(undefined, 'fakeSessionId', 'https://na1.salesforce.com');

    expect(AuthInfo.create).toHaveBeenCalledWith({
      accessTokenOptions: {
        accessToken: 'fakeSessionId',
        loginUrl: 'https://na1.salesforce.com',
        instanceUrl: 'https://na1.salesforce.com'
      }
    });
    expect(Connection.create).toHaveBeenCalledWith({ authInfo: mockAuthInfo });
    expect(sobject).toHaveBeenCalledWith('ApexDebuggerSession');
    expect(update).toHaveBeenCalledWith({ Id: '07aXX0000000002', Status: 'Detach' });
    expect(showSuccessNotification).toHaveBeenCalledWith(
      'SFDX: Stop Apex Debugger Session',
      'Apex Debugger session stopped.',
      false
    );
  });
});
