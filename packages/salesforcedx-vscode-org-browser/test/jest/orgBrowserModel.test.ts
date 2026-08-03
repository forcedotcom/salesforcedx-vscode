/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalogEntry, OrgMetadataReference } from 'salesforcedx-vscode-services';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { makeFilterState } from '../../src/browser/filter';
import { OrgBrowserModel, type OrgBrowserCatalog } from '../../src/browser/orgBrowserModel';
import type { OrgBrowserNode } from '../../src/browser/protocol';

const entry = (
  kind: OrgMetadataCatalogEntry['kind'],
  xmlName: string,
  fullName?: string,
  overrides: Partial<OrgMetadataCatalogEntry> = {}
): OrgMetadataCatalogEntry => ({
  orgId: '00D-test',
  observedAt: '2026-07-31T00:00:00.000Z',
  provenance: 'metadata-api',
  reference: { xmlName, ...(fullName ? { fullName } : {}) },
  documentUri: URI.parse(`sf-org-metadata://00D-test/${xmlName}/${fullName ?? '__type__'}`),
  name: fullName?.split('/').at(-1) ?? xmlName,
  kind,
  inOrg: true,
  inWorkspace: false,
  ...overrides
});

const catalog = ({
  roots = [],
  inventory = new Map<string, readonly OrgMetadataCatalogEntry[]>(),
  cached = new Map<string, readonly OrgMetadataCatalogEntry[] | undefined>()
}: {
  roots?: readonly OrgMetadataCatalogEntry[];
  inventory?: ReadonlyMap<string, readonly OrgMetadataCatalogEntry[]>;
  cached?: ReadonlyMap<string, readonly OrgMetadataCatalogEntry[] | undefined>;
} = {}): OrgBrowserCatalog & {
  readonly getChildren: jest.Mock;
  readonly getChildrenCached: jest.Mock;
  readonly refresh: jest.Mock;
} => {
  const key = (reference: OrgMetadataReference): string => `${reference.xmlName ?? ''}:${reference.fullName ?? ''}`;
  return {
    getChildren: jest.fn((reference: OrgMetadataReference = {}) =>
      Effect.succeed(reference.xmlName ? (inventory.get(key(reference)) ?? []) : roots)
    ),
    getChildrenCached: jest.fn((reference: OrgMetadataReference) => Effect.succeed(cached.get(key(reference)))),
    refresh: jest.fn(() => Effect.void)
  };
};

describe('OrgBrowserModel', () => {
  it('projects sorted metadata types and foldered types with stable actions', async () => {
    const service = catalog({ roots: [entry('type', 'Report'), entry('type', 'ApexClass')] });
    const model = new OrgBrowserModel(makeFilterState(true, true, ''), Effect.succeed(service));

    await expect(Effect.runPromise(model.getRoots())).resolves.toEqual([
      expect.objectContaining({ id: 'type:ApexClass', kind: 'type', actions: ['refresh', 'retrieve'] }),
      expect.objectContaining({ id: 'folderType:Report', kind: 'folderType', actions: ['refresh'] })
    ]);
  });

  it('filters presence combinations', async () => {
    const service = catalog({
      roots: [
        entry('type', 'ApexClass'),
        entry('type', 'CustomObject', undefined, { inOrg: false, inWorkspace: true, provenance: 'workspace' })
      ]
    });
    const local = new OrgBrowserModel(makeFilterState(true, false, ''), Effect.succeed(service));
    const remote = new OrgBrowserModel(makeFilterState(false, true, ''), Effect.succeed(service));

    await expect(Effect.runPromise(local.getRoots())).resolves.toEqual([
      expect.objectContaining({ xmlName: 'CustomObject', presence: 'local' })
    ]);
    await expect(Effect.runPromise(remote.getRoots())).resolves.toEqual([
      expect.objectContaining({ xmlName: 'ApexClass', presence: 'org' })
    ]);
  });

  it('does not acquire uncached inventories while filtering roots', async () => {
    const service = catalog({ roots: [entry('type', 'ApexClass')] });
    const model = new OrgBrowserModel(makeFilterState(true, true, 'ApexClass:Foo*'), Effect.succeed(service));

    await expect(Effect.runPromise(model.getRoots())).resolves.toHaveLength(1);
    expect(service.getChildrenCached).toHaveBeenCalledWith({ xmlName: 'ApexClass' });
    expect(service.getChildren).toHaveBeenCalledTimes(1);
  });

  it('filters cached inventories immediately', async () => {
    const service = catalog({
      roots: [entry('type', 'ApexClass'), entry('type', 'ApexTrigger')],
      cached: new Map([
        ['ApexClass:', [entry('component', 'ApexClass', 'FooTest')]],
        ['ApexTrigger:', [entry('component', 'ApexTrigger', 'OtherTrigger')]]
      ])
    });
    const model = new OrgBrowserModel(makeFilterState(true, true, 'Apex*:Foo*'), Effect.succeed(service));

    await expect(Effect.runPromise(model.getRoots())).resolves.toEqual([
      expect.objectContaining({ xmlName: 'ApexClass' })
    ]);
  });

  it('projects folder and component hierarchy and supported manageable states', async () => {
    const service = catalog({
      inventory: new Map([
        ['Report:', [entry('folder', 'Report', 'Dreamhouse')]],
        [
          'Report:Dreamhouse',
          [
            entry('component', 'Report', 'Dreamhouse/Active'),
            entry('component', 'Report', 'Dreamhouse/Locked', { manageableState: 'installed' })
          ]
        ]
      ])
    });
    const model = new OrgBrowserModel(makeFilterState(true, true, ''), Effect.succeed(service));
    const reportType: OrgBrowserNode = {
      id: 'folderType:Report',
      kind: 'folderType',
      label: 'Report',
      xmlName: 'Report',
      expandable: true,
      presence: 'org',
      actions: ['refresh']
    };
    const folders = await Effect.runPromise(model.getChildren(reportType));
    const reports = await Effect.runPromise(model.getChildren(folders[0]));

    expect(folders).toEqual([expect.objectContaining({ kind: 'folder', fullName: 'Dreamhouse' })]);
    expect(reports).toEqual([expect.objectContaining({ kind: 'component', fullName: 'Dreamhouse/Active' })]);
  });

  it('projects Custom Objects and detailed Custom Fields', async () => {
    const service = catalog({
      inventory: new Map([
        ['CustomObject:', [entry('component', 'CustomObject', 'Broker__c')]],
        [
          'CustomObject:Broker__c',
          [
            entry('component', 'CustomField', 'Broker__c.Name__c', {
              field: { name: 'Name__c', type: 'string', length: 80 }
            })
          ]
        ]
      ])
    });
    const model = new OrgBrowserModel(makeFilterState(true, true, ''), Effect.succeed(service));
    const objectType: OrgBrowserNode = {
      id: 'type:CustomObject',
      kind: 'type',
      label: 'CustomObject',
      xmlName: 'CustomObject',
      expandable: true,
      presence: 'org',
      actions: ['refresh', 'retrieve']
    };
    const objects = await Effect.runPromise(model.getChildren(objectType));
    const fields = await Effect.runPromise(model.getChildren(objects[0]));

    expect(objects).toEqual([expect.objectContaining({ kind: 'customObject', fullName: 'Broker__c' })]);
    expect(fields).toEqual([expect.objectContaining({ kind: 'customField', label: 'Name__c | string | length: 80' })]);
  });

  it('projects inventory-backed Custom Fields without optional describe details', async () => {
    const service = catalog({
      inventory: new Map([
        ['CustomObject:', [entry('component', 'CustomObject', 'Broker__c')]],
        ['CustomObject:Broker__c', [entry('component', 'CustomField', 'Broker__c.Email__c')]]
      ])
    });
    const model = new OrgBrowserModel(makeFilterState(true, true, ''), Effect.succeed(service));
    const objectType: OrgBrowserNode = {
      id: 'type:CustomObject',
      kind: 'type',
      label: 'CustomObject',
      xmlName: 'CustomObject',
      expandable: true,
      presence: 'org',
      actions: ['refresh', 'retrieve']
    };
    const objects = await Effect.runPromise(model.getChildren(objectType));
    const fields = await Effect.runPromise(model.getChildren(objects[0]));

    expect(fields).toEqual([expect.objectContaining({ kind: 'customField', label: 'Broker__c.Email__c' })]);
  });

  it('retrieves the currently visible type members and explicitly refreshes catalog data', async () => {
    const service = catalog({
      inventory: new Map([
        ['ApexClass:', [entry('component', 'ApexClass', 'FooTest'), entry('component', 'ApexClass', 'Other')]]
      ])
    });
    const model = new OrgBrowserModel(makeFilterState(true, true, 'ApexClass:Foo*'), Effect.succeed(service));
    const type: OrgBrowserNode = {
      id: 'type:ApexClass',
      kind: 'type',
      label: 'ApexClass',
      xmlName: 'ApexClass',
      expandable: true,
      presence: 'org',
      actions: ['refresh', 'retrieve']
    };

    await expect(Effect.runPromise(model.getRetrieveMembers(type))).resolves.toEqual([
      { type: 'ApexClass', fullName: 'FooTest' }
    ]);
    await Effect.runPromise(model.refresh(type));
    expect(service.refresh).toHaveBeenCalledWith({ xmlName: 'ApexClass' });
  });
});
