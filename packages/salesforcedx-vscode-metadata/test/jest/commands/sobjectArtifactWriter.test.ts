/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import type { SObject } from 'salesforcedx-vscode-services';
import { OrgMetadataCatalog } from 'salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalog';
import { ProjectService } from 'salesforcedx-vscode-services/src/core/projectService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import type * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { streamAndWriteSobjectArtifacts } from '../../../src/commands/sobjectArtifactWriter';

const sobject = (name: string, custom: boolean): SObject => ({
  name,
  label: name,
  custom,
  queryable: true,
  fields: [],
  childRelationships: []
});

const makeHarness = () => {
  const summaries = [
    { name: 'Account', custom: false, queryable: true },
    { name: 'Property__c', custom: true, queryable: true }
  ];
  const refreshSObjects = jest.fn(() => Effect.succeed(summaries));
  const listSObjects = jest.fn(() => Effect.succeed(summaries));
  const describeSObjects = jest.fn((names: readonly string[]) =>
    Effect.succeed(Stream.fromIterable(names.map(name => sobject(name, name.endsWith('__c')))))
  );
  const safeDelete = jest.fn((_uri: URI, _options?: { readonly recursive?: boolean }) => Effect.void);
  const createDirectory = jest.fn(() => Effect.void);
  const writeFile = jest.fn((_uri: URI, _content: string) => Effect.void);
  const path = (name: string) => Effect.succeed(URI.file(`/workspace/.sfdx/${name}`));
  const fsService = { safeDelete, createDirectory, writeFile } as unknown as InstanceType<typeof FsService>;
  const projectService = {
    getFauxStandardObjectsPath: () => path('standard'),
    getFauxCustomObjectsPath: () => path('custom'),
    getTypingsPath: () => path('typings'),
    getSoqlMetadataPath: () => path('soql'),
    getSoqlStandardObjectsPath: () => path('soql/standard'),
    getSoqlCustomObjectsPath: () => path('soql/custom')
  } as unknown as InstanceType<typeof ProjectService>;
  const catalog = {
    refreshSObjects,
    listSObjects,
    describeSObjects
  } as unknown as InstanceType<typeof OrgMetadataCatalog>;
  const provider = {
    getServicesApi: Effect.succeed({
      services: {
        FsService,
        ProjectService,
        OrgMetadataCatalog
      }
    })
  } as unknown as ExtensionProviderService;
  return {
    mocks: { createDirectory, describeSObjects, listSObjects, refreshSObjects, safeDelete, writeFile },
    provider,
    services: { catalog, fsService, projectService }
  };
};

const cancellationToken = {
  isCancellationRequested: false,
  onCancellationRequested: jest.fn()
} as unknown as vscode.CancellationToken;

const runWriter = (
  category: 'ALL' | 'CUSTOM' | 'STANDARD',
  harness: ReturnType<typeof makeHarness>,
  source: 'manual' | 'startup' = 'manual'
) =>
  Effect.runPromise(
    streamAndWriteSobjectArtifacts({
      cancellationToken,
      category,
      source,
      progress: { report: jest.fn() }
    }).pipe(
      Effect.provideService(ExtensionProviderService, harness.provider),
      Effect.provideService(FsService, harness.services.fsService),
      Effect.provideService(ProjectService, harness.services.projectService),
      Effect.provideService(OrgMetadataCatalog, harness.services.catalog)
    )
  );

describe('streamAndWriteSobjectArtifacts catalog integration', () => {
  it('refreshes catalog discovery for a manual run and writes catalog descriptions', async () => {
    const harness = makeHarness();
    const { mocks } = harness;

    const result = await runWriter('ALL', harness);

    expect(result.data).toEqual({ cancelled: false, standardObjects: 1, customObjects: 1 });
    expect(mocks.refreshSObjects).toHaveBeenCalledTimes(1);
    expect(mocks.listSObjects).not.toHaveBeenCalled();
    expect(mocks.describeSObjects).toHaveBeenCalledWith(['Account', 'Property__c']);
    expect(mocks.writeFile.mock.calls.map(([uri]) => uri.path)).toEqual(
      expect.arrayContaining([
        '/workspace/.sfdx/soql/typeNames.json',
        '/workspace/.sfdx/standard/Account.cls',
        '/workspace/.sfdx/custom/Property__c.cls',
        '/workspace/.sfdx/soql/standard/Account.json',
        '/workspace/.sfdx/soql/custom/Property__c.json'
      ])
    );
    expect(mocks.safeDelete.mock.calls.map(([uri]) => uri.path)).toEqual(
      expect.arrayContaining([
        '/workspace/.sfdx/standard',
        '/workspace/.sfdx/custom',
        '/workspace/.sfdx/typings',
        '/workspace/.sfdx/soql/standard',
        '/workspace/.sfdx/soql/custom'
      ])
    );
  });

  it('preserves custom artifacts when a standard refresh follows a custom refresh', async () => {
    const harness = makeHarness();
    const { mocks } = harness;

    await runWriter('CUSTOM', harness);

    expect(mocks.describeSObjects).toHaveBeenLastCalledWith(['Property__c']);
    expect(mocks.safeDelete.mock.calls.map(([uri]) => uri.path)).toEqual([
      '/workspace/.sfdx/custom',
      '/workspace/.sfdx/soql/custom'
    ]);

    mocks.safeDelete.mockClear();
    mocks.writeFile.mockClear();
    await runWriter('STANDARD', harness);

    expect(mocks.describeSObjects).toHaveBeenLastCalledWith(['Account']);
    expect(mocks.safeDelete.mock.calls.map(([uri]) => uri.path)).toEqual([
      '/workspace/.sfdx/standard',
      '/workspace/.sfdx/soql/standard'
    ]);
    expect(mocks.safeDelete.mock.calls.map(([uri]) => uri.path)).not.toContain('/workspace/.sfdx/custom');
    expect(mocks.safeDelete.mock.calls.map(([uri]) => uri.path)).not.toContain('/workspace/.sfdx/soql/custom');
    expect(mocks.safeDelete.mock.calls.map(([uri]) => uri.path)).not.toContain('/workspace/.sfdx/typings');

    const typeNamesWrite = mocks.writeFile.mock.calls.find(
      ([uri]) => uri.path === '/workspace/.sfdx/soql/typeNames.json'
    );
    expect(typeNamesWrite?.[1]).toBe(
      JSON.stringify(
        [
          { name: 'Account', custom: false, queryable: true },
          { name: 'Property__c', custom: true, queryable: true }
        ],
        null,
        2
      )
    );
  });

  it('uses cached catalog discovery for a startup run', async () => {
    const harness = makeHarness();
    const { mocks } = harness;

    await runWriter('ALL', harness, 'startup');

    expect(mocks.listSObjects).toHaveBeenCalledTimes(1);
    expect(mocks.refreshSObjects).not.toHaveBeenCalled();
    expect(mocks.describeSObjects).toHaveBeenCalledWith(['Account', 'Property__c']);
  });
});
