/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import {
  ChannelService,
  ConnectionService,
  ExecuteAnonymousService,
  type ExecuteAnonymousResult
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import type { MockInstance } from 'vitest';
import { makeChannelServiceLayer } from '../../../src/services/channelService.js';
import {
  ExecuteAnonymousServiceLayer,
  executeAnonymousWithConnection
} from '../../../src/services/executeAnonymousService.js';

const request = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const connection = {
  accessToken: '00D000000000001!fixture',
  instanceUrl: 'https://fixture.example',
  version: '67.0',
  request,
  baseUrl: () => 'https://fixture.example/services/data/v67.0'
} as unknown as Connection;
const success = {
  compiled: 'true',
  success: 'true',
  line: -1,
  column: -1,
  compileProblem: '',
  exceptionMessage: '',
  exceptionStackTrace: ''
};
const soap = (result: Record<string, unknown> = success, logBody?: string) => ({
  'soapenv:Envelope': {
    ...(logBody === undefined ? {} : { 'soapenv:Header': { DebuggingInfo: { debugLog: logBody } } }),
    'soapenv:Body': { executeAnonymousResponse: { result } }
  }
});
const diagnostics = {
  name: 'apex-anon-errors',
  clear: vi.fn(),
  delete: vi.fn(),
  dispose: vi.fn(),
  set: vi.fn(),
  get: () => undefined,
  has: () => false,
  forEach: vi.fn(),
  [Symbol.iterator]: () => [][Symbol.iterator]()
} satisfies vscode.DiagnosticCollection;
const output = {
  name: 'Caller',
  append: vi.fn(),
  appendLine: vi.fn(),
  replace: vi.fn(),
  clear: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  dispose: vi.fn()
} satisfies vscode.OutputChannel;
beforeEach(() => {
  request.mockResolvedValue(soap(success, 'LOG BODY'));
  connection.accessToken = '00D000000000001!fixture';
  vi.mocked(vscode.languages.createDiagnosticCollection).mockReturnValue(diagnostics);
  const createOutput: MockInstance = vi.mocked(vscode.window.createOutputChannel);
  createOutput.mockReturnValue(output);
});
const makeRuntime = () =>
  ManagedRuntime.make(
    ExecuteAnonymousServiceLayer.pipe(
      Layer.provide(Layer.mock(ConnectionService, { getConnection: () => Effect.succeed(connection) }))
    )
  );

it('executes the actual V4 Apex SOAP operation and preserves the services result/log contract', async () => {
  const runtime = makeRuntime();
  try {
    expect(
      await runtime.runPromise(
        ExecuteAnonymousService.use(service => service.executeAndRetrieveLog('System.debug(1);'))
      )
    ).toEqual({
      result: { compiled: true, success: true, line: -1, column: -1 },
      logBody: 'LOG BODY',
      logId: undefined
    });
    expect(request).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ method: 'POST', url: 'https://fixture.example/services/Soap/s/67.0/00D000000000001' })
    );
    expect(request.mock.calls[0]?.[0]).toHaveProperty('body', expect.stringContaining('System.debug(1);'));
  } finally {
    await runtime.dispose();
  }
  expect(diagnostics.dispose).toHaveBeenCalledTimes(1);
});
it.each([
  [
    {
      ...success,
      compiled: 'false',
      success: 'false',
      line: 3,
      column: 12,
      compileProblem: 'Unexpected token',
      exceptionMessage: {},
      exceptionStackTrace: {}
    },
    { compiled: false, success: false, line: 3, column: 12, compileProblem: 'Unexpected token' }
  ],
  [
    {
      ...success,
      success: 'false',
      line: 6,
      column: 1,
      exceptionMessage: 'Assertion failed',
      exceptionStackTrace: 'AnonymousBlock: line 6'
    },
    {
      compiled: true,
      success: false,
      line: 6,
      column: 1,
      exceptionMessage: 'Assertion failed',
      exceptionStackTrace: 'AnonymousBlock: line 6'
    }
  ]
])('maps native compilation/runtime failures into the matching result variant %#', async (response, result) => {
  request.mockResolvedValue(soap(response));
  expect(await Effect.runPromise(executeAnonymousWithConnection(connection, 'bad apex'))).toEqual({
    result,
    logBody: '',
    logId: undefined
  });
});
it('rejects a missing token without calling SOAP and maps decode/transport failures', async () => {
  connection.accessToken = undefined;
  expect(await Effect.runPromise(executeAnonymousWithConnection(connection, 'code').pipe(Effect.flip))).toMatchObject({
    _tag: 'ExecuteAnonymousError',
    message: 'Execute anonymous failed: no access token'
  });
  expect(request).not.toHaveBeenCalled();
  connection.accessToken = '00D000000000001!fixture';
  request.mockResolvedValueOnce({});
  expect(await Effect.runPromise(executeAnonymousWithConnection(connection, 'code').pipe(Effect.flip))).toMatchObject({
    _tag: 'ExecuteAnonymousError',
    message: 'Invalid execute anonymous SOAP response',
    cause: { _tag: 'ApexResponseDecodeError' }
  });
  request.mockRejectedValueOnce(new Error('network failed'));
  expect(await Effect.runPromise(executeAnonymousWithConnection(connection, 'code').pipe(Effect.flip))).toMatchObject({
    _tag: 'ExecuteAnonymousError',
    cause: { _tag: 'ApexOperationError' }
  });
});
it('uses the Apex library session-refresh policy without adding retries', async () => {
  request
    .mockRejectedValueOnce(Object.assign(new Error('INVALID_SESSION_ID'), { name: 'ERROR_HTTP_500' }))
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(soap());
  expect((await Effect.runPromise(executeAnonymousWithConnection(connection, 'code'))).result.success).toBe(true);
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[1]?.[0]).toEqual({ method: 'GET', url: connection.baseUrl() });
});
it.each([
  [
    { compiled: false, success: false, line: 3, column: 12, compileProblem: 'Unexpected token' },
    'Error: Line 3, Column 12 -- Unexpected token',
    'Unexpected token',
    12,
    11
  ],
  [
    { compiled: true, success: false, line: 0, column: 0, exceptionMessage: null, exceptionStackTrace: null },
    'Compile: success / Error: Unexpected error during anonymous Apex execution\n',
    'Unexpected error during anonymous Apex execution',
    0,
    0
  ]
] satisfies [ExecuteAnonymousResult, string, string, number, number][])(
  'reports to the caller channel with selection-adjusted diagnostics %#',
  async (result, text, message, line, character) => {
    const runtime = makeRuntime();
    const caller = ManagedRuntime.make(makeChannelServiceLayer('Caller'));
    const uri = URI.parse('memfs:/scripts/anonymous.apex');
    try {
      const service = await runtime.runPromise(ExecuteAnonymousService);
      await caller.runPromise(service.reportExecResult(result, uri, 10, 'INLINE LOG'));
      expect(output.clear).toHaveBeenCalledTimes(1);
      expect(output.appendLine.mock.calls).toEqual([[text], ['INLINE LOG']]);
      expect(output.show).toHaveBeenCalledTimes(1);
      expect(diagnostics.delete).toHaveBeenCalledWith(uri);
      expect(diagnostics.set).toHaveBeenCalledWith(uri, [
        expect.objectContaining({
          message,
          severity: vscode.DiagnosticSeverity.Error,
          range: { start: { line, character }, end: { line, character } }
        })
      ]);
      expect(output.dispose).not.toHaveBeenCalled();
    } finally {
      await runtime.dispose();
      await caller.dispose();
    }
  }
);
it('clears stale diagnostics on success, omits an empty log, and keeps caller channels independent', async () => {
  const runtime = makeRuntime();
  const caller = ManagedRuntime.make(makeChannelServiceLayer('Caller'));
  const uri = URI.file('/script.apex');
  try {
    const service = await runtime.runPromise(ExecuteAnonymousService);
    await caller.runPromise(service.reportExecResult({ compiled: true, success: true, line: 1, column: 1 }, uri));
    expect(output.appendLine.mock.calls).toEqual([['Execute anonymous succeeded.']]);
    expect(diagnostics.delete).toHaveBeenCalledWith(uri);
    expect(diagnostics.set).not.toHaveBeenCalled();
    await runtime.runPromise(service.clearDiagnostics(uri));
    expect(diagnostics.delete).toHaveBeenCalledTimes(2);
    await runtime.dispose();
    expect(
      Exit.isFailure(
        await caller.runPromiseExit(
          service.reportExecResult({ compiled: true, success: true, line: 1, column: 1 }, uri)
        )
      )
    ).toBe(true);
    await caller.runPromise(ChannelService.use(channel => channel.appendToChannel('still active')));
    expect(output.appendLine).toHaveBeenLastCalledWith('still active');
    expect(output.dispose).not.toHaveBeenCalled();
  } finally {
    await runtime.dispose();
    await caller.dispose();
  }
});
it('keeps genuine cancellation and closes diagnostics only after admitted work stops', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<unknown>();
  request.mockImplementationOnce(() => {
    started.resolve();
    return release.promise;
  });
  const runtime = makeRuntime();
  const service = await runtime.runPromise(ExecuteAnonymousService);
  const running = Effect.runPromiseExit(service.executeAndRetrieveLog('System.debug(1);'));
  await started.promise;
  try {
    await runtime.dispose();
    const exit = await running;
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(exit.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
    expect(diagnostics.dispose).toHaveBeenCalledTimes(1);
    expect(Exit.isFailure(await Effect.runPromiseExit(service.clearDiagnostics(URI.file('/late.apex'))))).toBe(true);
    expect(diagnostics.delete).not.toHaveBeenCalled();
  } finally {
    release.resolve(soap());
    await runtime.dispose();
  }
});
it('retains native diagnostic cleanup defects', async () => {
  const defect = new Error('diagnostic cleanup failed');
  diagnostics.dispose.mockImplementationOnce(() => {
    throw defect;
  });
  const runtime = makeRuntime();
  await runtime.runPromise(ExecuteAnonymousService);
  const exit = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit))
    expect(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === defect)).toBe(true);
});
