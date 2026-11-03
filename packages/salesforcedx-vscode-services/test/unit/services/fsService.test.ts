/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DocumentUriSchema, FsService, HashableUri, OrgId, type FsProvider } from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import * as HashSet from 'effect/HashSet';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { expectTypeOf } from 'vitest';
import { FsServiceLayer } from '../../../src/services/fsService.js';
import { toUri } from '../../../src/services/uriUtils.js';
import { WebFileSystemProvider } from '../../../src/services/webFileSystemProvider.js';

afterEach(() => vi.unstubAllEnvs());
const provide = <A, E>(program: Effect.Effect<A, E, FsService>, provider?: FsProvider) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(FsServiceLayer.pipe(Layer.provide(Layer.succeed(WebFileSystemProvider, { get: () => provider }))))
    )
  );

it('keeps desktop and web file discovery on their existing backends', async () => {
  const desktop = [URI.file('/project/a.cls')];
  const web = [URI.parse('memfs:/project/a.cls')];
  vi.mocked(vscode.workspace.findFiles).mockResolvedValue(desktop);
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  expect(await provide(FsService.use(service => service.findFiles('**/*.cls')))).toEqual(desktop);
  vi.stubEnv('ESBUILD_PLATFORM', 'web');
  const findFiles = vi.fn().mockResolvedValue(web);
  expect(
    await provide(
      FsService.use(service => service.findFiles('**/*.cls')),
      { findFiles } as unknown as FsProvider
    )
  ).toEqual(web);
  expect(findFiles).toHaveBeenCalledExactlyOnceWith('**/*.cls', undefined, undefined);
  expect(vscode.workspace.findFiles).toHaveBeenCalledTimes(1);
  expect(await provide(FsService.use(service => service.findFiles('**/*.cls')))).toEqual([]);
});

it('preserves URI schemes, UNC paths and Windows equality without changing display casing', () => {
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  expect(toUri('C:/Project/File.cls').path).toBe('/c:/Project/File.cls');
  // Preserve the legacy helper's UNC representation, rather than changing its authority semantics.
  expect(toUri('\\\\server\\share\\File.cls').path).toBe('/server/share/File.cls');
  expect(toUri('memfs:/Project/File.cls').scheme).toBe('memfs');
  const upper = HashableUri.fromUri(URI.parse('file:///C:/Project/File.cls'));
  const lower = HashableUri.fromUri(URI.parse('file:///c:/project/file.cls'));
  expect(Equal.equals(upper, lower)).toBe(true);
  expect(HashSet.size(HashSet.make(upper, lower))).toBe(1);
  expect(upper.uri.path).toBe('/c:/Project/File.cls');
  expect(Equal.equals(upper, { uri: upper.uri })).toBe(false);
});

it('creates parents only for safe writes and keeps readJSON failures typed', async () => {
  const calls: string[] = [];
  vi.mocked(vscode.workspace.fs.createDirectory).mockImplementation(() => {
    calls.push('directory');
    return Promise.resolve();
  });
  vi.mocked(vscode.workspace.fs.writeFile).mockImplementation(() => {
    calls.push('write');
    return Promise.resolve();
  });
  const path = URI.parse('memfs:/project/a.json');
  await provide(FsService.use(service => service.safeWriteFile(path, '{}')));
  await provide(FsService.use(service => service.writeFile(path, '{}')));
  expect(calls).toEqual(['directory', 'write', 'write']);
  vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{"value":42}'));
  expect(
    await provide(
      FsService.use(service =>
        service.readJSON(path.toString(), Schema.decodeUnknownEffect(Schema.Struct({ value: Schema.String })))
      ).pipe(Effect.flip)
    )
  ).toMatchObject({
    _tag: 'FsServiceError',
    function: 'readJSON',
    filePath: path.toString()
  });
});

it('retains decoded JSON codec types instead of widening branded IDs and transformed URIs to strings', async () => {
  vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
    new TextEncoder().encode(
      JSON.stringify({
        orgId: '00D000000000001',
        document: 'sf-org-metadata:/orgs/00D000000000001/ApexClass/Foo.cls'
      })
    )
  );
  const result = await provide(
    FsService.use(service =>
      service.readJSON(
        '/project/catalog.json',
        Schema.decodeUnknownEffect(
          Schema.Struct({
            orgId: OrgId,
            document: DocumentUriSchema
          })
        )
      )
    )
  );
  expectTypeOf(result.orgId).toEqualTypeOf<OrgId>();
  expectTypeOf(result.document).toEqualTypeOf<URI>();
  expect(result.orgId).toBe('00D000000000001');
  expect(URI.isUri(result.document)).toBe(true);
  expect(result.document.scheme).toBe('sf-org-metadata');
});

class DecodePrefix extends Context.Service<DecodePrefix, { readonly prefix: string }>()('test/FsDecodePrefix') {}
class CallerRejected extends Schema.TaggedError<CallerRejected>()('CallerRejected', { message: Schema.String }) {}

it('runs the caller decoder with its required services and wraps only its typed failures', async () => {
  vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{"value":"result"}'));
  const decode = (value: unknown) =>
    Schema.decodeUnknownEffect(Schema.Struct({ value: Schema.String }))(value).pipe(
      Effect.flatMap(parsed => DecodePrefix.pipe(Effect.map(({ prefix }) => `${prefix}${parsed.value}`)))
    );
  const program = FsService.use(service => service.readJSON('/caller.json', decode));
  expectTypeOf<Effect.Services<typeof program>>().toEqualTypeOf<FsService | DecodePrefix>();
  expect(await provide(program.pipe(Effect.provideService(DecodePrefix, { prefix: 'decoded:' })))).toBe(
    'decoded:result'
  );

  const callerError = new CallerRejected({ message: 'Invalid caller value' });
  const rejected = await provide(
    FsService.use(service => service.readJSON('/caller.json', () => Effect.fail(callerError))).pipe(Effect.flip)
  );
  expect(rejected).toMatchObject({
    _tag: 'FsServiceError',
    function: 'readJSON',
    filePath: '/caller.json',
    message: 'Invalid caller value'
  });
  expect(rejected.cause).toBe(callerError);
});

it('does not execute a decoder after malformed JSON or a file read failure', async () => {
  const decode = vi.fn((value: unknown) => Effect.succeed(value));
  vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{'));
  expect(
    await provide(FsService.use(service => service.readJSON('/broken.json', decode)).pipe(Effect.flip))
  ).toMatchObject({
    _tag: 'FsServiceError',
    function: 'readJSON',
    filePath: '/broken.json'
  });
  const nativeFailure = new Error('Cannot read caller file');
  vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(nativeFailure);
  expect(
    await provide(FsService.use(service => service.readJSON('/missing.json', decode)).pipe(Effect.flip))
  ).toMatchObject({
    _tag: 'FsServiceError',
    function: 'readFile',
    filePath: '/missing.json'
  });
  expect(decode).not.toHaveBeenCalled();
});

it('preserves caller decoder defects, thrown exceptions and interruption', async () => {
  vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('{}'));
  const defect = new Error('Caller decoder defect');
  for (const decode of [
    () => Effect.die(defect),
    () => {
      throw defect;
    }
  ]) {
    const exit = await provide(FsService.use(service => service.readJSON('/caller.json', decode)).pipe(Effect.exit));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit))
      expect(exit.cause.reasons).toContainEqual(expect.objectContaining({ _tag: 'Die', defect }));
  }
  const interrupted = await provide(
    FsService.use(service => service.readJSON('/caller.json', () => Effect.interrupt)).pipe(Effect.exit)
  );
  expect(Exit.isFailure(interrupted)).toBe(true);
  if (Exit.isFailure(interrupted)) expect(Cause.hasInterrupts(interrupted.cause)).toBe(true);
});
