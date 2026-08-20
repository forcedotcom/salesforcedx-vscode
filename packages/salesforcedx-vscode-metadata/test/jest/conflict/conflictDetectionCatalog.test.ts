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
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ComponentSetService } from 'salesforcedx-vscode-services/src/core/componentSetService';
import { OrgMetadataCatalog } from 'salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalog';
import { SourceTrackingService } from 'salesforcedx-vscode-services/src/core/sourceTrackingService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { HashableUri } from 'salesforcedx-vscode-services/src/vscode/hashableUri';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
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
const catalogReference = { type: 'ApexClass', fullName: 'ConflictTest' };

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
  const getStatus = jest.fn(() =>
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
  const getEntries = jest.fn((references: readonly (typeof catalogReference)[]) =>
    Effect.succeed(
      references.map(componentReference => ({
        reference: componentReference,
        lastModifiedDate: '2026-07-31T00:00:00.000Z'
      }))
    )
  );
  const catalog = { getEntries } as unknown as InstanceType<typeof OrgMetadataCatalog>;
  const sourceTracking = { getStatus } as unknown as InstanceType<typeof SourceTrackingService>;
  const toUri = jest.fn((path: string | URI) => Effect.succeed(typeof path === 'string' ? URI.file(path) : path));
  const readFile = jest.fn((uri: string | URI) =>
    Effect.succeed(uri.toString().includes('metadata-shadow') ? 'remote source' : 'local source')
  );
  const safeDelete = jest.fn(() => Effect.void);
  const fsService = { HashableUri, readFile, safeDelete, toUri } as unknown as InstanceType<typeof FsService>;
  const getComponentSetFromUris = jest.fn(() => Effect.succeed(componentSet));
  const ensureNonEmptyComponentSet = jest.fn((value: ComponentSet) => Effect.succeed(value));
  const componentSetService = {
    ensureNonEmptyComponentSet,
    getComponentSetFromUris
  } as unknown as InstanceType<typeof ComponentSetService>;
  const remoteComponentSet = {
    getComponentFilenamesByNameAndType: () => [remoteUri.fsPath]
  } as unknown as ComponentSet;
  const buildComponentSet = jest.fn(() => Effect.succeed(remoteComponentSet));
  const retrieveComponentSetToDirectory = jest.fn(() => Effect.succeed({ components: remoteComponentSet }));
  const workspaceService = {
    getWorkspaceInfoOrThrow: () => Effect.succeed({ uri: URI.file('/workspace') })
  } as unknown as InstanceType<typeof WorkspaceService>;
  const provider = {
    getServicesApi: Effect.succeed({
      services: {
        ComponentSetService,
        FsService,
        MetadataRetrieveService: { buildComponentSet, retrieveComponentSetToDirectory },
        OrgMetadataCatalog,
        SourceTrackingService,
        TargetOrgRef: () => SubscriptionRef.make({ orgId: 'org-one' }),
        WorkspaceService
      }
    })
  } as unknown as ExtensionProviderService;

  return {
    mocks: {
      ensureNonEmptyComponentSet,
      getStatus,
      getComponentSetFromUris,
      getEntries,
      retrieveComponentSetToDirectory,
      readFile,
      toUri
    },
    provider,
    services: { catalog, componentSetService, fsService, sourceTracking, workspaceService }
  };
};

const runWithHarness = <A, E, R>(effect: Effect.Effect<A, E, R>, harness: ReturnType<typeof makeHarness>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(ExtensionProviderService, harness.provider),
      Effect.provideService(FsService, harness.services.fsService),
      Effect.provideService(OrgMetadataCatalog, harness.services.catalog),
      Effect.provideService(SourceTrackingService, harness.services.sourceTracking),
      Effect.provideService(ComponentSetService, harness.services.componentSetService),
      Effect.provideService(WorkspaceService, harness.services.workspaceService)
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
    expect(harness.mocks.getStatus).toHaveBeenCalledWith({ local: true, remote: true });
    expect(harness.mocks.retrieveComponentSetToDirectory).toHaveBeenCalledTimes(1);
    expect(harness.mocks.getEntries).not.toHaveBeenCalled();
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
    expect(harness.mocks.getEntries).toHaveBeenCalledWith([catalogReference], { consistency: 'refresh' });
    expect(harness.mocks.retrieveComponentSetToDirectory).toHaveBeenCalledTimes(1);
    expect(harness.mocks.getStatus).not.toHaveBeenCalled();
  });

  it('does not materialize remote source when catalog timestamps show no deploy conflict', async () => {
    const harness = makeHarness();
    mockBuildTimestampIndex.mockReturnValue(
      Effect.succeed(new Map([['ApexClass:ConflictTest', DateTime.unsafeMake(new Date('2026-08-01T00:00:00.000Z'))]]))
    );

    const conflicts = await runWithHarness(detectConflictsFromTimestamps(componentSet, 'deploy'), harness);

    expect(conflicts).toEqual([]);
    expect(harness.mocks.getEntries).toHaveBeenCalledWith([catalogReference], { consistency: 'refresh' });
    expect(harness.mocks.retrieveComponentSetToDirectory).not.toHaveBeenCalled();
    expect(harness.mocks.readFile).not.toHaveBeenCalled();
  });
});
