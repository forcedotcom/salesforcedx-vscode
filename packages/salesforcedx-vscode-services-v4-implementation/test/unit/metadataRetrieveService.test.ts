/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection, Global, SfProject, StateAggregator } from '@salesforce/core';
import coreFs from '@salesforce/core/fs';
import { ComponentSet, MetadataApiRetrieve } from '@salesforce/source-deploy-retrieve';
import {
  ActiveMetadataOperationRef,
  ComponentSetService,
  ConnectionService,
  FsService,
  MetadataRetrieveError,
  MetadataRetrieveService,
  OrgId
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import assert from 'node:assert/strict';
import type * as FsPromises from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { catalogReaderLayers } from '../../src/catalogLayers.js';
import { ConnectionHost } from '../../src/connectionHost.js';
import { OrgCatalogState } from '../../src/orgCatalog/orgCatalogState.js';
import { OrgCatalogRemoteRetrieve } from '../../src/orgCatalog/orgCatalogRemoteRetrieve.js';
import { OrgMetadataShadowStore } from '../../src/orgCatalog/orgMetadataShadowStore.js';
import { OrgChanges } from '../../src/targetOrgRef.js';
import { WebFileSystemProvider } from '../../src/webFileSystemProvider.js';
import { installVscodeFs } from '../support/vscodeFs.js';

const originalFs = coreFs.fs;
const sdkCreateConnection = Connection.create.bind(Connection);
const orgId = Schema.decodeUnknownSync(OrgId)('00D000000000001');
const directories: string[] = [];
// Metadata API ZIP: unpackaged/classes/Remote.cls, its descriptor, and package.xml (API 67.0).
const metadataZip =
  'UEsDBBQAAAAIAAAAXl1Bt1XwGAAAABYAAAAdAAAAdW5wYWNrYWdlZC9jbGFzc2VzL1JlbW90ZS5jbHMrKE3KyUxWSM5JLC5WCErNzS9JVaiuBQBQSwMEFAAAAAgAAABeXS43Yz1jAAAAewAAACYAAAB1bnBhY2thZ2VkL2NsYXNzZXMvUmVtb3RlLmNscy1tZXRhLnhtbE3NwQmAMAxA0VXEAZoioiCxIO7gPdSIBWuLieL4XkQ8/nf5OGS+x41Eijtuu/Tlqpo7AEmUjSzp8Gx8ilBZ24CtIbLSTEqlQ8ph4kNC2l3TGovwAxQlPcUNXsPFCG8ifD/3AFBLAwQUAAAACAAAAF5dS7BNbnYAAACYAAAAFgAAAHVucGFja2FnZWQvcGFja2FnZS54bWw1zm0KwkAMRdGtSBcwGUQqSAyIGxB3EMf4gc1kaILU3SvS/jxwHzw8cXnxXVaTDtX33SOi7QDcuCW/2VgkFVNY59xD3oBK8JWDO8L4NHFCFb3I6HQWtRCExVhZhQ5NpuPA7gh/I8yz9695WqV+mzLCIoT5Dn0BUEsBAhQDFAAAAAgAAABeXUG3VfAYAAAAFgAAAB0AAAAAAAAAAAAAAIABAAAAAHVucGFja2FnZWQvY2xhc3Nlcy9SZW1vdGUuY2xzUEsBAhQDFAAAAAgAAABeXS43Yz1jAAAAewAAACYAAAAAAAAAAAAAAIABUwAAAHVucGFja2FnZWQvY2xhc3Nlcy9SZW1vdGUuY2xzLW1ldGEueG1sUEsBAhQDFAAAAAgAAABeXUuwTW52AAAAmAAAABYAAAAAAAAAAAAAAIAB+gAAAHVucGFja2FnZWQvcGFja2FnZS54bWxQSwUGAAAAAAMAAwDjAAAApAEAAAAA';
const binaryMetadataZip =
  'UEsDBBQAAAAIAAAAXl15gOphCAAAAAYAAAAoAAAAdW5wYWNrYWdlZC9zdGF0aWNyZXNvdXJjZXMvQmxvYi5yZXNvdXJjZWP438DAyAQAUEsDBBQAAAAIAAAAXl25MvtsegAAAKcAAAAxAAAAdW5wYWNrYWdlZC9zdGF0aWNyZXNvdXJjZXMvQmxvYi5yZXNvdXJjZS1tZXRhLnhtbFWOwQrCMBBEf0V6txtEPEjMxR+Q6g+s60oLSTYkU9C/N0d7G2beMOPvYCwyabO1iu4+KeZ2GWagnImacRnb23oyiiU6OHcid6Sk4BeDh+CFZdarZVSL4bY+4yKeNqaXLjTj8S0auJRO9EnLZALFvqEqp975ozxtb4UfUEsDBBQAAAAIAAAAXl3+6OwVeQAAAJsAAAAWAAAAdW5wYWNrYWdlZC9wYWNrYWdlLnhtbDWOUQrCQAxEryI9wGYRqSAxH55A6gnSNWqxu1maKHp7i7Sfb5g3DJ45Pfkum08eix2bh3s9AJhyDXbTKUlImmEbYwtxB1mcr+zcEPq3ihFmyb1MRqdRe4SVsHAWujj7kDoxfc1DCP8QYTHfc3HQQu0+RISVEJZH9ANQSwECFAMUAAAACAAAAF5deYDqYQgAAAAGAAAAKAAAAAAAAAAAAAAAgAEAAAAAdW5wYWNrYWdlZC9zdGF0aWNyZXNvdXJjZXMvQmxvYi5yZXNvdXJjZVBLAQIUAxQAAAAIAAAAXl25MvtsegAAAKcAAAAxAAAAAAAAAAAAAACAAU4AAAB1bnBhY2thZ2VkL3N0YXRpY3Jlc291cmNlcy9CbG9iLnJlc291cmNlLW1ldGEueG1sUEsBAhQDFAAAAAgAAABeXf7o7BV5AAAAmwAAABYAAAAAAAAAAAAAAIABFwEAAHVucGFja2FnZWQvcGFja2FnZS54bWxQSwUGAAAAAAMAAwD5AAAAxAEAAAAA';
let cancelListener: (() => void) | undefined;
let listenerDisposals = 0;
let onTaskFailure: (() => void) | undefined;
const host = Layer.succeed(ConnectionHost, {
  globalState: { get: vi.fn(), update: () => Promise.resolve(undefined), keys: () => [], setKeysForSync: vi.fn() },
  messages: {
    expired: 'expired',
    expiredDetail: 'expired',
    login: 'login',
    refreshFailed: 'failed',
    orgChanged: id => `Org changed: ${id}`
  }
});
const graph = catalogReaderLayers.pipe(
  Layer.provide(Layer.merge(host, Layer.succeed(WebFileSystemProvider, { get: () => undefined })))
);
const jsonResponse = <T>(promise: Promise<T>) =>
  Object.assign(promise, {
    stream: () => {
      throw new Error('JSON fixture only');
    }
  });
const readRemoteFromOutput = async (output: URI): Promise<string> => {
  // SDR's native directory conversion creates a metadataPackage_* child; do not replace that behavior in a fake.
  const files = await coreFs.fs.promises.readdir(output.fsPath, { recursive: true });
  const source = files.find(file => file.endsWith('Remote.cls'));
  assert.ok(source, 'native extraction must produce a source file beneath the requested output');
  return String(await coreFs.fs.promises.readFile(join(output.fsPath, source)));
};
const start = async () => {
  const directory = await mkdtemp(`${process.env.RUNNER_TEMP ?? tmpdir()}/v4-retrieve-`);
  directories.push(directory);
  const root = URI.file(directory);
  vi.stubEnv('HOME', directory);
  vi.spyOn(Global, 'SF_DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sf').fsPath);
  vi.spyOn(Global, 'SFDX_DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sfdx').fsPath);
  vi.spyOn(Global, 'DIR', 'get').mockReturnValue(Utils.joinPath(root, 'home', '.sfdx').fsPath);
  const classes = Utils.joinPath(root, 'force-app', 'main', 'default', 'classes');
  await coreFs.fs.promises.mkdir(classes.fsPath, { recursive: true });
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(root, 'sfdx-project.json').fsPath,
    JSON.stringify({
      packageDirectories: [{ path: 'force-app', default: true }],
      namespace: '',
      sourceApiVersion: '67.0'
    })
  );
  await coreFs.fs.promises.mkdir(Utils.joinPath(root, '.sf').fsPath, { recursive: true });
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(root, '.sf', 'config.json').fsPath,
    '{"target-org":"retrieve@example.com","org-api-version":"67.0"}'
  );
  const source = Utils.joinPath(classes, 'Remote.cls');
  await coreFs.fs.promises.writeFile(source.fsPath, 'public class Remote {}');
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(classes, 'Remote.cls-meta.xml').fsPath,
    '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>'
  );
  await coreFs.fs.promises.writeFile(source.fsPath, 'public class Remote { /* local */ }');
  Object.defineProperty(vscode.workspace, 'workspaceFolders', {
    configurable: true,
    value: [{ uri: root, name: 'retrieve', index: 0 }]
  });
  // Real connection watchers acknowledge registration against fixture-owned global paths.
  await coreFs.fs.promises.mkdir(Global.SF_DIR, { recursive: true });
  await coreFs.fs.promises.mkdir(Global.SFDX_DIR, { recursive: true });
  await coreFs.fs.promises.writeFile(
    Utils.joinPath(URI.file(Global.SF_DIR), 'config.json').fsPath,
    '{"target-org":"retrieve@example.com","org-api-version":"67.0"}'
  );
  await coreFs.fs.promises.writeFile(Utils.joinPath(URI.file(Global.SFDX_DIR), 'alias.json').fsPath, '{"orgs":{}}');
  const auth = await AuthInfo.create({
    accessTokenOptions: {
      instanceUrl: 'https://fixture.example',
      accessToken: 'fixture-secret',
      username: 'retrieve@example.com',
      orgId,
      isDevHub: false,
      namespacePrefix: '',
      isScratch: false,
      isSandbox: false
    }
  });
  auth.update({ refreshToken: 'fixture-refresh-secret', tracksSource: false });
  await auth.save();
  const runtime = ManagedRuntime.make(graph);
  const connection = await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
  const service = await runtime.runPromise(MetadataRetrieveService);
  const components = await runtime.runPromise(
    service
      .buildComponentSet([{ type: 'ApexClass', fullName: 'Remote' }])
      .pipe(
        Effect.flatMap(value =>
          ComponentSetService.use(componentService => componentService.ensureNonEmptyComponentSet(value))
        )
      )
  );
  const output = Utils.joinPath(
    root,
    '.sf',
    'orgs',
    orgId,
    'remoteMetadata',
    'catalog-staging',
    'retrieve.__staging__'
  );
  const response = {
    id: '09S000000000001',
    done: true,
    success: true,
    status: 'Succeeded',
    zipFile: metadataZip,
    fileProperties: [
      {
        fullName: 'Remote',
        type: 'ApexClass',
        fileName: 'unpackaged/classes/Remote.cls',
        lastModifiedDate: '2026-10-30T00:00:00.000Z'
      }
    ]
  } as Awaited<ReturnType<typeof connection.metadata.checkRetrieveStatus>>;
  vi.spyOn(connection.metadata, 'retrieve').mockResolvedValue({ id: response.id, done: false, state: 'InProgress' });
  vi.spyOn(connection.metadata, 'checkRetrieveStatus').mockResolvedValue(response);
  return { runtime, connection, service, components, output, source, response, root };
};
beforeEach(async () => {
  vi.stubEnv('FORCE_MEMFS', 'false');
  vi.stubEnv('ESBUILD_PLATFORM', 'node');
  vi.stubEnv('SF_USE_GENERIC_UNIX_KEYCHAIN', 'true');
  coreFs.setFs(coreFs.getVirtualFs());
  SfProject.clearInstances();
  await StateAggregator.clearInstanceAsync();
  // FORCE_MEMFS=false selects actual Node operations; the SDK's VirtualFs declaration erases some overloads.
  installVscodeFs(coreFs.fs.promises as typeof FsPromises);
  cancelListener = undefined;
  listenerDisposals = 0;
  onTaskFailure = undefined;
  const settings: Record<string, unknown> = {
    instanceUrl: 'https://fixture.example',
    accessToken: 'fixture-secret',
    apiVersion: '67.0',
    sessionContext: {
      username: 'retrieve@example.com',
      orgId,
      userId: '005000000000001',
      namespacePrefix: '',
      isDevHub: false,
      isScratch: false,
      isSandbox: false
    }
  };
  vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
    get: (key: string) => settings[key],
    update: vi.fn()
  } as unknown as vscode.WorkspaceConfiguration);
  vi.spyOn(Connection, 'create').mockImplementation(options =>
    sdkCreateConnection({ ...options, connectionOptions: { version: '67.0' } })
  );
  vi.spyOn(Connection.prototype, 'retrieveMaxApiVersion').mockResolvedValue('67.0');
  vi.spyOn(Connection.prototype, 'request').mockImplementation(function (this: Connection) {
    return jsonResponse(
      Promise.resolve({ totalSize: 1, done: true, records: [{ Id: '005000000000001', Username: this.getUsername() }] })
    );
  });
  vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
  vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() => ({
    onDidCreate: () => ({ dispose: () => undefined }),
    onDidChange: () => ({ dispose: () => undefined }),
    onDidDelete: () => ({ dispose: () => undefined }),
    dispose: () => undefined,
    ignoreCreateEvents: false,
    ignoreChangeEvents: false,
    ignoreDeleteEvents: false
  }));
  vi.mocked(vscode.workspace.onDidChangeConfiguration).mockImplementation(() => ({ dispose: () => undefined }));
  vi.mocked(vscode.window.withProgress).mockImplementation((_options, task) =>
    Promise.resolve(
      task(
        { report: () => undefined },
        {
          isCancellationRequested: false,
          onCancellationRequested: listener => {
            cancelListener = () => {
              listener(undefined);
            };
            return {
              dispose: () => {
                cancelListener = undefined;
                listenerDisposals++;
              }
            };
          }
        }
      )
    ).catch(cause => {
      onTaskFailure?.();
      throw cause;
    })
  );
});
afterEach(async () => {
  await StateAggregator.clearInstanceAsync();
  SfProject.clearInstances();
  vi.restoreAllMocks();
  coreFs.setFs(originalFs);
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

it('runs native SDK nonmerge retrieve/extraction, records evidence, preserves workspace source, and disposes the progress listener', async () => {
  const { runtime, service, components, output, source } = await start();
  try {
    const result = await runtime.runPromise(
      service.retrieveComponentSetToDirectory(components, output, { expectedOrgId: orgId })
    );
    expect(result.components).toBeInstanceOf(ComponentSet);
    expect(await readRemoteFromOutput(output)).toBe('public class Remote {}');
    expect(String(await coreFs.fs.promises.readFile(source.fsPath))).toBe('public class Remote { /* local */ }');
    expect(result.getFileResponses().map(response => response.fullName)).toContain('Remote');
    const state = await runtime.runPromise(OrgCatalogState);
    expect((await runtime.runPromise(state.getInventory(orgId, 'ApexClass')))?.componentIdentityOrder).toHaveLength(1);
    expect(await runtime.runPromise(ActiveMetadataOperationRef.pipe(Effect.flatMap(SubscriptionRef.get)))).toBe(0);
    expect(listenerDisposals).toBe(1);
    expect(cancelListener).toBeUndefined();
  } finally {
    await runtime.dispose();
  }
});

it('materializes native binary metadata into an org/revision shadow without text decoding or leftover staging', async () => {
  const { runtime, connection, source, root } = await start();
  const network = vi.spyOn(connection.metadata, 'retrieve');
  try {
    vi.mocked(connection.metadata.checkRetrieveStatus).mockResolvedValue({
      id: '09S000000000001',
      done: true,
      success: true,
      status: 'Succeeded',
      zipFile: binaryMetadataZip,
      fileProperties: [
        {
          fullName: 'Blob',
          type: 'StaticResource',
          fileName: 'unpackaged/staticresources/Blob.resource',
          lastModifiedDate: '2026-10-30T00:00:00.000Z'
        }
      ]
    } as Awaited<ReturnType<typeof connection.metadata.checkRetrieveStatus>>);
    const remote = await runtime.runPromise(OrgCatalogRemoteRetrieve);
    const artifacts = await runtime.runPromise(
      remote.materializeRetrievedComponents(orgId, [{ reference: { xmlName: 'StaticResource', fullName: 'Blob' } }])
    );
    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0]!.artifact;
    expect(artifact.primaryUri.path).toContain('/metadata-shadow/StaticResource/Blob/revisions/');
    expect(Buffer.from(await coreFs.fs.promises.readFile(artifact.primaryUri.fsPath))).toEqual(
      Buffer.from([0, 255, 128, 0, 1, 2])
    );
    expect(artifact.remoteLastModifiedDate).toBe('2026-10-30T00:00:00.000Z');
    expect(artifact.fileUris.some(uri => uri.path.endsWith('Blob.resource-meta.xml'))).toBe(true);
    expect(String(await coreFs.fs.promises.readFile(source.fsPath))).toBe('public class Remote { /* local */ }');
    const stagingRoot = Utils.joinPath(root, '.sf', 'orgs', orgId, 'remoteMetadata', 'catalog-staging');
    expect(
      (await coreFs.fs.promises.readdir(stagingRoot.fsPath, { recursive: true })).some(name =>
        name.endsWith('.__staging__')
      )
    ).toBe(false);
    await runtime.dispose();
    const calls = network.mock.calls.length;
    expect(
      Exit.isFailure(
        await Effect.runPromiseExit(
          remote.materializeRetrievedComponents(orgId, [{ reference: { xmlName: 'StaticResource', fullName: 'Blob' } }])
        )
      )
    ).toBe(true);
    expect(network).toHaveBeenCalledTimes(calls);
  } finally {
    await runtime.dispose();
  }
});

it('rejects an obsolete retrieve epoch before publishing a shadow, after actual native extraction settles', async () => {
  const { runtime, connection, response } = await start();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<typeof response>();
  vi.mocked(connection.metadata.checkRetrieveStatus).mockImplementationOnce(() => {
    entered.resolve();
    return release.promise;
  });
  try {
    const remote = await runtime.runPromise(OrgCatalogRemoteRetrieve);
    const reference = { xmlName: 'ApexClass', fullName: 'Remote' };
    const reading = runtime.runPromise(remote.materializeRetrievedComponents(orgId, [{ reference }]).pipe(Effect.flip));
    await Promise.race([
      entered.promise,
      reading.then(() => assert.fail('Retrieve ended before the delayed native response'))
    ]);
    await runtime.runPromise(OrgChanges.use(changes => changes.clear));
    await runtime.runPromise(ConnectionService.use(connections => connections.getConnection()));
    release.resolve(response);
    expect(await reading).toMatchObject({ _tag: 'InactiveOrgOperationError' });
    const shadow = await runtime.runPromise(OrgMetadataShadowStore);
    expect(await runtime.runPromise(shadow.get(orgId, reference, '2026-10-30T00:00:00.000Z'))).toBeUndefined();
  } finally {
    release.resolve(response);
    await runtime.dispose();
  }
});

it('replays UI cancellation requested while native SDK start is pending, then awaits polling before returning', async () => {
  const { runtime, service, components, output } = await start();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  // eslint-disable-next-line vitest/unbound-method -- Invoked below with .call(this), preserving each native SDK operation's receiver.
  const nativeStart = MetadataApiRetrieve.prototype.start;
  vi.spyOn(MetadataApiRetrieve.prototype, 'start').mockImplementationOnce(async function (this: MetadataApiRetrieve) {
    entered.resolve();
    await release.promise;
    return nativeStart.call(this);
  });
  const cancel = vi.spyOn(MetadataApiRetrieve.prototype, 'cancel');
  try {
    const reading = runtime.runPromise(service.retrieveComponentSetToDirectory(components, output).pipe(Effect.flip));
    await Promise.race([
      entered.promise,
      reading.then(() => assert.fail('Retrieve ended before the pending native start'))
    ]);
    cancelListener?.();
    expect(cancel).not.toHaveBeenCalled();
    release.resolve();
    expect(await reading).toMatchObject({ _tag: 'UserCancellationError' });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(listenerDisposals).toBe(1);
    expect(cancelListener).toBeUndefined();
  } finally {
    release.resolve();
    await runtime.dispose();
  }
});

it.each(['cancel', 'dispose'] as const)(
  'awaits actual native extraction before %s permits caller staging cleanup',
  async action => {
    const { runtime, connection, service, components, output, response } = await start();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<typeof response>();
    vi.mocked(connection.metadata.checkRetrieveStatus).mockImplementationOnce(() => {
      entered.resolve();
      return release.promise;
    });
    let extractedBeforeCleanup: string | undefined;
    try {
      const fs = await runtime.runPromise(FsService);
      const reading = Effect.runFork(
        service.retrieveComponentSetToDirectory(components, output).pipe(
          Effect.ensuring(
            Effect.promise(() => readRemoteFromOutput(output)).pipe(
              Effect.tap(content =>
                Effect.sync(() => {
                  extractedBeforeCleanup = content;
                })
              ),
              Effect.andThen(fs.safeDelete(output, { recursive: true }))
            )
          )
        )
      );
      await Promise.race([
        entered.promise,
        Effect.runPromise(Fiber.await(reading)).then(() =>
          assert.fail('Retrieve ended before the pending status response')
        )
      ]);
      const stopped = vi.fn<() => void>();
      const stopping = (action === 'cancel' ? Effect.runPromise(Fiber.interrupt(reading)) : runtime.dispose()).then(
        stopped
      );
      await Effect.runPromise(Effect.yieldNow);
      expect(stopped).not.toHaveBeenCalled();
      release.resolve(response);
      await stopping;
      expect(Exit.isFailure(await Effect.runPromise(Fiber.await(reading)))).toBe(true);
      expect(extractedBeforeCleanup).toBe('public class Remote {}');
      await expect(coreFs.fs.promises.stat(output.fsPath)).rejects.toBeDefined();
      expect(listenerDisposals).toBe(1);
      expect(cancelListener).toBeUndefined();
    } finally {
      release.resolve(response);
      await runtime.dispose();
    }
  }
);

it.each(['cancel', 'dispose'] as const)(
  'retains a native SDK failure completed just before %s interrupts Effect consumption',
  async action => {
    // Exercise both sides of Promise settlement/Effect consumption rather than depend on one scheduler turn.
    for (const turns of [4, 5, 6, 7, 8, 9, 10]) {
      await StateAggregator.clearInstanceAsync();
      const { runtime, connection, service, components, output } = await start();
      const failure = new Error(`native retrieve failed before consumption (${turns})`);
      const failed = Promise.withResolvers<void>();
      onTaskFailure = () => {
        failed.resolve();
      };
      vi.mocked(connection.metadata.retrieve).mockRejectedValueOnce(failure);
      const hasNativeFailure = (exit: Exit.Exit<unknown, unknown>) =>
        Exit.isFailure(exit) &&
        exit.cause.reasons.some(reason => {
          const error = reason._tag === 'Fail' ? reason.error : reason._tag === 'Die' ? reason.defect : undefined;
          return Schema.is(MetadataRetrieveError)(error) && error.cause === failure;
        });
      const disposedBefore = listenerDisposals;
      try {
        const reading = Effect.runFork(service.retrieveComponentSetToDirectory(components, output));
        await failed.promise;
        for (let index = 0; index < turns; index++) await Promise.resolve();
        const stopped = await Effect.runPromise(
          (action === 'cancel' ? Fiber.interrupt(reading) : runtime.disposeEffect).pipe(Effect.exit)
        );
        const read = await Effect.runPromise(Fiber.await(reading));
        // Already-consumed failures belong to the caller; interrupted consumption must reach caller or owner cleanup.
        expect(hasNativeFailure(read) || hasNativeFailure(stopped), `${action} after ${turns} microtasks`).toBe(true);
        expect(listenerDisposals).toBe(disposedBefore + 1);
        expect(cancelListener).toBeUndefined();
      } finally {
        const closing = await Effect.runPromise(runtime.disposeEffect.pipe(Effect.exit));
        if (Exit.isFailure(closing)) expect(hasNativeFailure(closing)).toBe(true);
      }
    }
  }
);
