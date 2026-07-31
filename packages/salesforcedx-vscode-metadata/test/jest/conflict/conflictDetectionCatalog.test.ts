/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import { ComponentSetService } from 'salesforcedx-vscode-services/src/core/componentSetService';
import { OrgMetadataCatalog } from 'salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalog';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';
import { URI } from 'vscode-uri';

const mockBuildTimestampIndex = jest.fn();
jest.mock('../../../src/conflict/resultStorage', () => ({
  buildTimestampIndex: () => mockBuildTimestampIndex()
}));

import { detectConflictsFromTracking } from '../../../src/conflict/conflictDetection';
import { detectConflictsFromTimestamps } from '../../../src/conflict/conflictDetectionTimestamp';

const localPath = '/workspace/force-app/main/default/classes/ConflictTest.cls';
const remoteUri = URI.file('/workspace/.sf/orgs/org-one/metadata-shadow/ApexClass/ConflictTest.cls');
const reference = { xmlName: 'ApexClass', fullName: 'ConflictTest' };

const sourceComponent = {
  fullName: reference.fullName,
  type: { name: reference.xmlName },
  content: localPath,
  xml: undefined,
  walkContent: () => []
} as unknown as SourceComponent;

const componentSet = {
  has: ({ type, fullName }: { type: string; fullName: string }) =>
    type === reference.xmlName && fullName === reference.fullName,
  getSourceComponents: () => ({ toArray: () => [sourceComponent] })
} as unknown as ComponentSet;

const makeHarness = () => {
  const getChangeStatus = jest.fn(() =>
    Effect.succeed([
      {
        orgId: 'org-one',
        observedAt: '2026-07-31T00:00:00.000Z',
        provenance: 'source-tracking' as const,
        fullName: reference.fullName,
        type: reference.xmlName,
        origin: 'remote' as const,
        state: 'modify',
        filePath: localPath,
        conflict: true
      }
    ])
  );
  const getEntry = jest.fn(() =>
    Effect.succeed({
      reference,
      lastModifiedDate: '2026-07-31T00:00:00.000Z'
    })
  );
  const materializeRemoteSources = jest.fn((references: readonly (typeof reference)[]) =>
    Effect.succeed(
      references.map(componentReference => ({
        reference: componentReference,
        artifact: {
          rootUri: remoteUri.with({ path: remoteUri.path.slice(0, remoteUri.path.lastIndexOf('/')) }),
          primaryUri: remoteUri,
          fileUris: [remoteUri],
          materializedAt: '2026-07-31T00:00:00.000Z'
        }
      }))
    )
  );
  const refreshMetadataComponents = jest.fn(() => Effect.succeed([]));
  const catalog = {
    getChangeStatus,
    getEntry,
    materializeRemoteSources,
    refreshMetadataComponents
  } as unknown as InstanceType<typeof OrgMetadataCatalog>;
  const toUri = jest.fn((path: string | URI) => Effect.succeed(typeof path === 'string' ? URI.file(path) : path));
  const readFile = jest.fn((uri: string | URI) =>
    Effect.succeed(uri.toString().includes('metadata-shadow') ? 'remote source' : 'local source')
  );
  const fsService = { HashableUri, readFile, toUri } as unknown as InstanceType<typeof FsService>;
  const getComponentSetFromUris = jest.fn(() => Effect.succeed(componentSet));
  const ensureNonEmptyComponentSet = jest.fn((value: ComponentSet) => Effect.succeed(value));
  const componentSetService = {
    ensureNonEmptyComponentSet,
    getComponentSetFromUris
  } as unknown as InstanceType<typeof ComponentSetService>;
  const provider = {
    getServicesApi: Effect.succeed({
      services: { ComponentSetService, FsService, OrgMetadataCatalog }
    })
  } as unknown as ExtensionProviderService;

  return {
    mocks: {
      ensureNonEmptyComponentSet,
      getChangeStatus,
      getComponentSetFromUris,
      getEntry,
      materializeRemoteSources,
      refreshMetadataComponents,
      readFile,
      toUri
    },
    provider,
    services: { catalog, componentSetService, fsService }
  };
};

const runWithHarness = <A, E, R>(effect: Effect.Effect<A, E, R>, harness: ReturnType<typeof makeHarness>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(ExtensionProviderService, harness.provider),
      Effect.provideService(FsService, harness.services.fsService),
      Effect.provideService(OrgMetadataCatalog, harness.services.catalog),
      Effect.provideService(ComponentSetService, harness.services.componentSetService)
    ) as Effect.Effect<A, E, never>
  );

describe('conflict detection catalog integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses catalog change status and materialized source for tracking conflicts', async () => {
    const harness = makeHarness();

    const conflicts = await runWithHarness(detectConflictsFromTracking(componentSet), harness);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].localUri.uri.path).toBe(localPath);
    expect(conflicts[0].remoteUri.uri.toString()).toBe(remoteUri.toString());
    expect(harness.mocks.getChangeStatus).toHaveBeenCalledWith({ local: true, remote: true });
    expect(harness.mocks.materializeRemoteSources).toHaveBeenCalledWith([reference], { consistency: 'refresh' });
    expect(harness.mocks.refreshMetadataComponents).not.toHaveBeenCalled();
    expect(harness.mocks.getEntry).not.toHaveBeenCalled();
  });

  it('uses catalog timestamps and materialized source for non-tracking deploy conflicts', async () => {
    const harness = makeHarness();
    mockBuildTimestampIndex.mockReturnValue(
      Effect.succeed(new Map([['ApexClass:ConflictTest', DateTime.unsafeMake(new Date('2026-07-30T00:00:00.000Z'))]]))
    );

    const conflicts = await runWithHarness(detectConflictsFromTimestamps(componentSet, 'deploy'), harness);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].localUri.uri.path).toBe(localPath);
    expect(conflicts[0].remoteUri.uri.toString()).toBe(remoteUri.toString());
    expect(harness.mocks.refreshMetadataComponents).toHaveBeenCalledWith({ xmlName: 'ApexClass' });
    expect(harness.mocks.getEntry).toHaveBeenCalledWith(reference);
    expect(harness.mocks.materializeRemoteSources).toHaveBeenCalledWith([reference], { consistency: 'refresh' });
    expect(harness.mocks.getChangeStatus).not.toHaveBeenCalled();
  });

  it('does not materialize remote source when catalog timestamps show no deploy conflict', async () => {
    const harness = makeHarness();
    mockBuildTimestampIndex.mockReturnValue(
      Effect.succeed(new Map([['ApexClass:ConflictTest', DateTime.unsafeMake(new Date('2026-08-01T00:00:00.000Z'))]]))
    );

    const conflicts = await runWithHarness(detectConflictsFromTimestamps(componentSet, 'deploy'), harness);

    expect(conflicts).toEqual([]);
    expect(harness.mocks.refreshMetadataComponents).toHaveBeenCalledWith({ xmlName: 'ApexClass' });
    expect(harness.mocks.getEntry).toHaveBeenCalledWith(reference);
    expect(harness.mocks.materializeRemoteSources).not.toHaveBeenCalled();
    expect(harness.mocks.readFile).not.toHaveBeenCalled();
  });
});
