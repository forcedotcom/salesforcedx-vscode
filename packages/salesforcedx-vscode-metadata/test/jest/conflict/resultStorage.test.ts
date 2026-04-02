/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as DateTime from 'effect/DateTime';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';
import { URI, Utils } from 'vscode-uri';
import { buildTimestampIndexFromDir } from '../../../src/conflict/resultStorage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DIR = URI.file('/test/fileResponses/org123');

/** Build a JSON string matching StoredResultSchema. */
const storedJson = (
  timestamp: string,
  operation: 'deploy' | 'retrieve',
  components: { metadataType: string; fullName: string; lastModifiedDate?: string }[]
) => JSON.stringify({ timestamp, operation, components });

const fileUri = (name: string) => Utils.joinPath(DIR, `${name}.json`);

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Creates a mock ExtensionProviderService that exposes the real FsService class
 * (required so static accessors delegate into the mock FsService context). */
const createMockExtensionProvider = () =>
  ({
    getServicesApi: Effect.succeed({ services: { FsService } })
  }) as unknown as ExtensionProviderService;

/**
 * Build a mock FsService from a files map.
 * deletedRef tracks every path passed to deleteFile.
 */
const makeMockFs = (
  files: Record<string, string>,
  deletedRef: Ref.Ref<string[]>
): Partial<InstanceType<typeof FsService>> => ({
  fileOrFolderExists: () => Effect.succeed(true),
  readDirectory: () => Effect.succeed(Object.keys(files).map(k => URI.parse(k))),
  readFile: (uri: string | URI) => {
    const content = files[uri.toString()];
    return content !== undefined
      ? Effect.succeed(content)
      : Effect.die(`unexpected readFile call for ${uri.toString()}`);
  },
  HashableUri,
  safeDelete: (uri: string | URI) =>
    Ref.update(deletedRef, arr => [...arr, typeof uri === 'string' ? uri : uri.toString()])
});

const provideServices = (mockFs: Partial<InstanceType<typeof FsService>>) =>
  <A, E, R>(e: Effect.Effect<A, E, R>) =>
    e.pipe(
      Effect.provideService(ExtensionProviderService, createMockExtensionProvider()),
      Effect.provideService(FsService, mockFs as InstanceType<typeof FsService>)
    );

/** Run an effect with mock services. Yields after completion so forkDaemon cleanup can execute. */
const runWithMocks = <A>(
  effect: Effect.Effect<A, unknown, unknown>,
  mockFs: Partial<InstanceType<typeof FsService>>
) =>
  Effect.runPromise(
    effect.pipe(
      // forkDaemon schedules cleanup outside the main fiber's execution; Effect.yieldNow()
      // is not sufficient — the daemon runs on the next macrotask. A short sleep crosses that boundary.
      Effect.tap(() => Effect.sleep(Duration.millis(10))),
      provideServices(mockFs)
    ) as Effect.Effect<A, never, never>
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTimestampIndexFromDir', () => {
  it('returns empty Map when directory does not exist', async () => {
    const deletedRef = Effect.runSync(Ref.make<string[]>([]));
    const mockFs: Partial<InstanceType<typeof FsService>> = {
      ...makeMockFs({}, deletedRef),
      // Override to simulate missing directory
      fileOrFolderExists: () => Effect.succeed(false)
    };

    const index = await runWithMocks(buildTimestampIndexFromDir(DIR), mockFs);

    expect(index.size).toBe(0);
    expect(Effect.runSync(Ref.get(deletedRef))).toHaveLength(0);
  });

  it('returns correct index from a single file and deletes nothing', async () => {
    const f1 = fileUri('deploy-2024-01-01');
    const files = {
      [f1.toString()]: storedJson('2024-01-01T00:00:00.000Z', 'deploy', [
        { metadataType: 'ApexClass', fullName: 'MyClass', lastModifiedDate: '2024-01-01T12:00:00.000Z' }
      ])
    };
    const deletedRef = Effect.runSync(Ref.make<string[]>([]));

    const index = await runWithMocks(buildTimestampIndexFromDir(DIR), makeMockFs(files, deletedRef));

    expect(index.size).toBe(1);
    const stored = index.get('ApexClass:MyClass');
    expect(stored).toBeDefined();
    expect(DateTime.toEpochMillis(stored!)).toBe(new Date('2024-01-01T12:00:00.000Z').getTime());
    expect(Effect.runSync(Ref.get(deletedRef))).toHaveLength(0);
  });

  it('deletes older file when newer fully supersedes it', async () => {
    const older = fileUri('deploy-2024-01-01');
    const newer = fileUri('deploy-2024-02-01');
    const files = {
      [older.toString()]: storedJson('2024-01-01T00:00:00.000Z', 'deploy', [
        { metadataType: 'ApexClass', fullName: 'MyClass', lastModifiedDate: '2024-01-01T00:00:00.000Z' }
      ]),
      [newer.toString()]: storedJson('2024-02-01T00:00:00.000Z', 'deploy', [
        { metadataType: 'ApexClass', fullName: 'MyClass', lastModifiedDate: '2024-02-01T00:00:00.000Z' }
      ])
    };
    const deletedRef = Effect.runSync(Ref.make<string[]>([]));

    const index = await runWithMocks(buildTimestampIndexFromDir(DIR), makeMockFs(files, deletedRef));

    // Index should reflect the newer lastModifiedDate
    const stored = index.get('ApexClass:MyClass');
    expect(DateTime.toEpochMillis(stored!)).toBe(new Date('2024-02-01T00:00:00.000Z').getTime());

    // Older file should have been deleted; newer file kept
    const deleted = Effect.runSync(Ref.get(deletedRef));
    expect(deleted).toContain(older.toString());
    expect(deleted).not.toContain(newer.toString());
  });

  it('does not delete older file when it still contributes a winning component', async () => {
    const older = fileUri('deploy-2024-01-01');
    const newer = fileUri('deploy-2024-02-01');
    // older has two components; newer only supersedes one of them
    const files = {
      [older.toString()]: storedJson('2024-01-01T00:00:00.000Z', 'deploy', [
        { metadataType: 'ApexClass', fullName: 'ClassA', lastModifiedDate: '2024-01-01T00:00:00.000Z' },
        { metadataType: 'ApexClass', fullName: 'ClassB', lastModifiedDate: '2024-01-01T00:00:00.000Z' }
      ]),
      [newer.toString()]: storedJson('2024-02-01T00:00:00.000Z', 'deploy', [
        { metadataType: 'ApexClass', fullName: 'ClassA', lastModifiedDate: '2024-02-01T00:00:00.000Z' }
      ])
    };
    const deletedRef = Effect.runSync(Ref.make<string[]>([]));

    await runWithMocks(buildTimestampIndexFromDir(DIR), makeMockFs(files, deletedRef));

    // ClassB only exists in older file, so older file must be kept
    const deleted = Effect.runSync(Ref.get(deletedRef));
    expect(deleted).not.toContain(older.toString());
    expect(deleted).not.toContain(newer.toString());
  });

  it('skips malformed JSON and deletes it as stale (no valid rows)', async () => {
    const bad = fileUri('bad-2024-01-01');
    const good = fileUri('deploy-2024-02-01');
    const files = {
      [bad.toString()]: 'this is not valid json {{{',
      [good.toString()]: storedJson('2024-02-01T00:00:00.000Z', 'retrieve', [
        { metadataType: 'CustomObject', fullName: 'Account__c', lastModifiedDate: '2024-02-01T00:00:00.000Z' }
      ])
    };
    const deletedRef = Effect.runSync(Ref.make<string[]>([]));

    const index = await runWithMocks(buildTimestampIndexFromDir(DIR), makeMockFs(files, deletedRef));

    // Valid file is processed correctly
    expect(index.get('CustomObject:Account__c')).toBeDefined();

    // Malformed file has no rows → stale → deleted
    const deleted = Effect.runSync(Ref.get(deletedRef));
    expect(deleted).toContain(bad.toString());
    expect(deleted).not.toContain(good.toString());
  });

  it('ignores non-.json files and does not read or delete them', async () => {
    const txtFile = Utils.joinPath(DIR, 'notes.txt');
    const jsonFile = fileUri('deploy-2024-01-01');
    const readCalls: string[] = [];

    const files: Record<string, string> = {
      [jsonFile.toString()]: storedJson('2024-01-01T00:00:00.000Z', 'deploy', [
        { metadataType: 'ApexClass', fullName: 'MyClass', lastModifiedDate: '2024-01-01T00:00:00.000Z' }
      ])
    };
    const deletedRef = Effect.runSync(Ref.make<string[]>([]));

    const mockFs: Partial<InstanceType<typeof FsService>> = {
      fileOrFolderExists: () => Effect.succeed(true),
      // directory contains both a .txt and a .json file
      readDirectory: () => Effect.succeed([txtFile, jsonFile]),
      readFile: (uri: string | URI) => {
        readCalls.push(uri.toString());
        const content = files[uri.toString()];
        return content !== undefined ? Effect.succeed(content) : Effect.die(`unexpected readFile: ${uri}`);
      },
      HashableUri,
      safeDelete: (uri: string | URI) =>
        Ref.update(deletedRef, arr => [...arr, typeof uri === 'string' ? uri : uri.toString()])
    };

    const index = await runWithMocks(buildTimestampIndexFromDir(DIR), mockFs);

    expect(index.size).toBe(1);
    expect(readCalls).not.toContain(txtFile.toString());
    const deleted = Effect.runSync(Ref.get(deletedRef));
    expect(deleted).not.toContain(txtFile.toString());
  });

  it('falls back to file-level timestamp when component lacks lastModifiedDate', async () => {
    const f1 = fileUri('deploy-2024-01-01');
    const fileTimestamp = '2024-01-15T08:00:00.000Z';
    const files = {
      [f1.toString()]: storedJson('2024-01-15T08:00:00.000Z', 'deploy', [
        // No lastModifiedDate field
        { metadataType: 'ApexClass', fullName: 'NoDate' }
      ])
    };
    const deletedRef = Effect.runSync(Ref.make<string[]>([]));

    const index = await runWithMocks(buildTimestampIndexFromDir(DIR), makeMockFs(files, deletedRef));

    const stored = index.get('ApexClass:NoDate');
    expect(stored).toBeDefined();
    // Should match the file-level timestamp
    expect(DateTime.toEpochMillis(stored!)).toBe(new Date(fileTimestamp).getTime());
  });
});
