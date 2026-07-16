/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { debuggerStop, DebuggerSessionQueryError } from '../../../src/commands/debuggerStop';

type QueryResult = { records: { Id: string }[] };

// Fake jsforce Connection: `tooling.query` returns the seeded records; `tooling.sobject(...).update` is a spy.
const makeConnection = (queryImpl: () => Promise<QueryResult>) => {
  const update = jest.fn(() => Promise.resolve({ success: true }));
  const sobject = jest.fn(() => ({ update }));
  return { conn: { tooling: { query: queryImpl, sobject } }, update, sobject };
};

// Provide the real ExtensionProviderService tag with a mock services api (ConnectionService + ChannelService).
const providerLayer = (conn: unknown) =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        ProjectService: { getSfProject: () => Effect.void },
        ConnectionService: { getConnection: () => Effect.succeed(conn) },
        ChannelService: Effect.succeed({
          appendToChannel: () => Effect.void,
          showChannel: Effect.void
        })
      }
    })
  } as unknown as ExtensionProviderService);

// providerLayer satisfies ConnectionService/ChannelService at runtime, but the api's typed accessors re-add
// them to the effect's R channel; cast R away since the layer fully provides them.
const run = (conn: unknown) =>
  Effect.runPromise(debuggerStop().pipe(Effect.provide(providerLayer(conn))) as Effect.Effect<void, unknown, never>);

const runFlipped = (conn: unknown) =>
  Effect.runPromise(
    debuggerStop().pipe(Effect.provide(providerLayer(conn)), Effect.flip) as Effect.Effect<unknown, never, never>
  );

describe('debuggerStop', () => {
  beforeEach(() => {
    (vscode.window.showInformationMessage as jest.Mock) = jest.fn();
  });

  it('shows "none found" and does NOT update when the query returns 0 records', async () => {
    const { conn, update } = makeConnection(() => Promise.resolve({ records: [] }));
    await run(conn);
    expect(update).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No Apex Debugger session found.');
  });

  it('detaches the session when the query returns a single 07a-prefixed record', async () => {
    const { conn, sobject, update } = makeConnection(() => Promise.resolve({ records: [{ Id: '07aXX0000000001' }] }));
    await run(conn);
    expect(sobject).toHaveBeenCalledWith('ApexDebuggerSession');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ Id: '07aXX0000000001', Status: 'Detach' });
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('does NOT update (info-message branch) when the single record Id is not 07a-prefixed', async () => {
    const { conn, update } = makeConnection(() => Promise.resolve({ records: [{ Id: '001XX0000000001' }] }));
    await run(conn);
    expect(update).not.toHaveBeenCalled();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('No Apex Debugger session found.');
  });

  it('surfaces a DebuggerSessionQueryError (not swallowed) when the query rejects', async () => {
    const { conn, update } = makeConnection(() => Promise.reject(new Error('boom')));
    const error = await runFlipped(conn);
    expect(error).toBeInstanceOf(DebuggerSessionQueryError);
    expect(update).not.toHaveBeenCalled();
  });
});
