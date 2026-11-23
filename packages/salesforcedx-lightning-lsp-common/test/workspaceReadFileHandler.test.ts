/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Option from 'effect/Option';
import * as Tracer from 'effect/Tracer';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { registerWorkspaceReadFileHandler } from '../src/workspaceReadFileHandler';

type HandlerServices = Parameters<typeof registerWorkspaceReadFileHandler>[1];
type HandlerClient = Parameters<typeof registerWorkspaceReadFileHandler>[0];

describe.each(['file', 'memfs'])('workspace filesystem handlers (%s)', scheme => {
  const uri = URI.from({ scheme, path: '/project/components' });
  const fileUri = Utils.joinPath(uri, 'example.js');
  const fileStat = { type: vscode.FileType.File, ctime: 1, mtime: 2, size: 3 };
  const spans: Tracer.Span[] = [];
  const tracer = Effect.runSync(Effect.tracer);
  const recordingTracer = Tracer.make({
    ...tracer,
    span: (...args) => {
      const span = tracer.span(...args);
      spans.push(span);
      return span;
    }
  });
  const fsService = {
    readFile: vi.fn(),
    stat: vi.fn(),
    findFiles: vi.fn(),
    deleteFile: vi.fn()
  };
  const client: HandlerClient = { onRequest: () => {} };
  const onRequest = vi.spyOn(client, 'onRequest');
  const appendLine = vi.fn();
  let runtime: ManagedRuntime.ManagedRuntime<never, never>;

  beforeEach(() => {
    spans.length = 0;
    fsService.readFile.mockReturnValue(Effect.succeed('export default {};'));
    fsService.stat.mockReturnValue(Effect.succeed(fileStat));
    fsService.findFiles.mockReturnValue(Effect.succeed([fileUri]));
    fsService.deleteFile.mockReturnValue(Effect.void);
    vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
      ['example.js', vscode.FileType.File],
      ['nested', vscode.FileType.Directory]
    ]);
    runtime = ManagedRuntime.make(Layer.setTracer(recordingTracer));
    registerWorkspaceReadFileHandler(
      client,
      {
        fsService: fsService as unknown as HandlerServices['fsService'],
        runPromise: runtime.runPromise as HandlerServices['runPromise']
      },
      { appendLine }
    );
  });

  afterEach(async () => runtime.dispose());

  const cases = [
    {
      operation: 'readFile',
      params: { uri: fileUri.toJSON() },
      result: { content: 'export default {};' },
      called: () =>
        expect(fsService.readFile).toHaveBeenCalledWith(expect.objectContaining({ scheme, path: fileUri.path }))
    },
    {
      operation: 'stat',
      params: { uri: fileUri.toJSON() },
      result: { stat: { type: 'file', ctime: 1, mtime: 2, size: 3, exists: true } },
      called: () => expect(fsService.stat).toHaveBeenCalledWith(fileUri.toString())
    },
    {
      operation: 'readDirectory',
      params: { uri: uri.toJSON() },
      result: {
        entries: [
          { name: 'example.js', type: 'file', uri: fileUri.toString() },
          { name: 'nested', type: 'directory', uri: Utils.joinPath(uri, 'nested').toString() }
        ]
      },
      called: () =>
        expect(vscode.workspace.fs.readDirectory).toHaveBeenCalledWith(
          expect.objectContaining({ scheme, path: uri.path })
        )
    },
    {
      operation: 'findFiles',
      params: { baseFolderUri: uri.toString(), pattern: '**/*.js' },
      result: { uris: [fileUri.toString()] },
      called: () =>
        expect(fsService.findFiles).toHaveBeenCalledWith(
          new vscode.RelativePattern(URI.parse(uri.toString()), '**/*.js')
        )
    },
    {
      operation: 'deleteFile',
      params: { uri: fileUri.toString() },
      result: {},
      called: () => expect(fsService.deleteFile).toHaveBeenCalledWith(fileUri.toString())
    }
  ];

  const request = (operation: string, params: unknown) =>
    onRequest.mock.calls.find(([method]) => method === `workspace/${operation}`)?.[1](params);

  const expectLocalOnlySpan = (operation: string, exit: 'Success' | 'Failure') => {
    expect(spans).toHaveLength(1);
    const [span] = spans;
    expect(span.name).toBe(`WorkspaceHandler.${operation}`);
    expect(Option.isNone(span.parent)).toBe(true);
    expect(span.attributes.get('telemetryIgnore')).toBe(true);
    expect(span.status).toMatchObject({ _tag: 'Ended', exit: { _tag: exit } });
  };

  it.each(cases)(
    'keeps $operation results and its parentless local span',
    async ({ operation, params, result, called }) => {
      expect(await request(operation, params)).toEqual(result);
      called();
      expectLocalOnlySpan(operation, 'Success');
    }
  );

  it.each(cases)('keeps $operation error handling and its parentless local span', async ({ operation, params }) => {
    const error = new Error('Filesystem unavailable');
    fsService.readFile.mockReturnValue(Effect.fail(error));
    fsService.stat.mockReturnValue(Effect.fail(error));
    fsService.findFiles.mockReturnValue(Effect.fail(error));
    fsService.deleteFile.mockReturnValue(Effect.fail(error));
    vi.mocked(vscode.workspace.fs.readDirectory).mockRejectedValue(error);

    const message: unknown = operation === 'readDirectory' ? expect.stringMatching(/\S/) : error.message;
    expect(await request(operation, params)).toEqual(
      operation === 'findFiles' ? { uris: undefined } : { error: message }
    );
    expect(appendLine).toHaveBeenCalledWith(
      operation === 'readDirectory'
        ? expect.stringMatching(/^\[readDirectory\] error: \S/)
        : expect.stringContaining(error.message)
    );
    expectLocalOnlySpan(operation, 'Failure');
  });

  it('keeps invalid stat result errors', async () => {
    fsService.stat.mockReturnValue(Effect.succeed(undefined));

    expect(await request('stat', { uri: fileUri.toJSON() })).toEqual({ error: 'Invalid stat result' });
    expectLocalOnlySpan('stat', 'Failure');
  });
});
