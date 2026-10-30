/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DocumentUriSchema, FsService, HashableUri, OrgId, type FsProvider } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import * as HashSet from 'effect/HashSet';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { expectTypeOf } from 'vitest';
import { FsServiceLayer } from '../../src/fsService.js';
import { toUri } from '../../src/uriUtils.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';

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
      FsService.use(service => service.readJSON(path.toString(), Schema.Struct({ value: Schema.String }))).pipe(
        Effect.flip
      )
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
        Schema.Struct({
          orgId: OrgId,
          document: DocumentUriSchema
        })
      )
    )
  );
  expectTypeOf(result.orgId).toEqualTypeOf<OrgId>();
  expectTypeOf(result.document).toEqualTypeOf<URI>();
  expect(result.orgId).toBe('00D000000000001');
  expect(URI.isUri(result.document)).toBe(true);
  expect(result.document.scheme).toBe('sf-org-metadata');
});
