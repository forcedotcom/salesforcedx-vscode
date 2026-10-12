/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet, RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ComponentSetService, type NonEmptyComponentSet } from '../../../src/core/componentSetService';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import { MetadataRetrieveService } from '../../../src/core/metadataRetrieveService';
import { OrgCatalogRemoteRetrieve } from '../../../src/orgCatalog/orgCatalogRemoteRetrieve';
import { OrgMetadataShadowStore } from '../../../src/orgCatalog/orgMetadataShadowStore';
import { FsService } from '../../../src/vscode/fsService';

const makeHarness = () => {
  const stagingUri = URI.file('/workspace/shadow.__staging__');
  const retrieveComponentSetToDirectory = jest.fn((_componentSet: unknown, _stagingUri: URI) =>
    Effect.succeed({
      components: {
        getSourceComponents: () => [],
        getComponentFilenamesByNameAndType: () => []
      },
      getFileResponses: () => [] as { filePath: string; fullName: string; state: string; type: string }[],
      response: {
        fileProperties: [] as { fullName: string; lastModifiedDate: string; type: string }[]
      }
    })
  );
  const readDirectoryWithTypes = jest.fn((_uri: string | URI) =>
    Effect.succeed([] as { readonly uri: URI; readonly type: vscode.FileType }[])
  );
  const publish = jest.fn((options: Parameters<OrgMetadataShadowStore['publish']>[0]) =>
    Effect.succeed({
      rootUri: options.stagingUri,
      primaryUri: options.primaryUri,
      fileUris: [...options.fileUris],
      remoteLastModifiedDate: options.remoteLastModifiedDate,
      materializedAt: '2026-10-12T00:00:00.000Z'
    })
  );
  const layer = OrgCatalogRemoteRetrieve.DefaultWithoutDependencies.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ComponentSetService, {
          ensureNonEmptyComponentSet: componentSet => Effect.succeed(componentSet as NonEmptyComponentSet)
        } as Pick<ComponentSetService, 'ensureNonEmptyComponentSet'> as ComponentSetService),
        Layer.mock(MetadataRegistryService, {
          _tag: 'MetadataRegistryService',
          getRegistryAccess: () => Effect.succeed(new RegistryAccess())
        }),
        Layer.mock(MetadataRetrieveService, {
          _tag: 'MetadataRetrieveService',
          buildComponentSet: members => Effect.succeed(new ComponentSet(members)),
          retrieveComponentSetToDirectory:
            retrieveComponentSetToDirectory as unknown as MetadataRetrieveService['retrieveComponentSetToDirectory']
        }),
        Layer.succeed(FsService, {
          readDirectoryWithTypes,
          toUri: path => Effect.succeed(typeof path === 'string' ? URI.file(path) : path),
          safeDelete: () => Effect.void
        } as Pick<FsService, 'readDirectoryWithTypes' | 'toUri' | 'safeDelete'> as FsService),
        Layer.mock(OrgMetadataShadowStore, {
          _tag: 'OrgMetadataShadowStore',
          prepare: () => Effect.succeed({ rootUri: stagingUri, stagingUri }),
          publish
        })
      )
    )
  );
  return { layer, publish, readDirectoryWithTypes, retrieveComponentSetToDirectory };
};

describe('OrgCatalogRemoteRetrieve', () => {
  it('materializes decomposed metadata represented only by a metadata XML file', async () => {
    const { layer, publish, retrieveComponentSetToDirectory } = makeHarness();
    retrieveComponentSetToDirectory.mockImplementation((_componentSet, stagingUri) => {
      const filePath = Utils.joinPath(
        stagingUri,
        'package',
        'main',
        'default',
        'objects',
        'Broker__c',
        'listViews',
        'All.listView-meta.xml'
      ).fsPath;
      return Effect.succeed({
        components: { getSourceComponents: () => [], getComponentFilenamesByNameAndType: () => [] },
        getFileResponses: () => [{ filePath, fullName: 'Broker__c.All', state: 'Created', type: 'ListView' }],
        response: { fileProperties: [{ fullName: 'Broker__c.All', lastModifiedDate: 'revision-1', type: 'ListView' }] }
      });
    });

    const [{ artifact }] = await OrgCatalogRemoteRetrieve.materializeRetrievedComponents('00D000000000001', [
      { reference: { xmlName: 'ListView', fullName: 'Broker__c.All' }, expectedRemoteLastModifiedDate: 'revision-1' }
    ]).pipe(Effect.provide(layer), Effect.runPromise);

    expect(artifact.primaryUri.path.endsWith('/objects/Broker__c/listViews/All.listView-meta.xml')).toBe(true);
    expect(artifact.fileUris).toEqual([artifact.primaryUri]);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: { xmlName: 'ListView', fullName: 'Broker__c.All' },
        primaryUri: artifact.primaryUri,
        remoteLastModifiedDate: 'revision-1'
      })
    );
  });

  it('materializes metadata by discovering files written to the staging directory', async () => {
    const { layer, readDirectoryWithTypes, retrieveComponentSetToDirectory } = makeHarness();
    let retrievedUri: URI | undefined;
    retrieveComponentSetToDirectory.mockImplementation((_componentSet, stagingUri) => {
      retrievedUri = Utils.joinPath(stagingUri, 'package', 'main', 'default', 'prompts', 'Property.prompt-meta.xml');
      return Effect.succeed({
        components: { getSourceComponents: () => [], getComponentFilenamesByNameAndType: () => [] },
        getFileResponses: () => [],
        response: { fileProperties: [] }
      });
    });
    readDirectoryWithTypes.mockImplementation(() =>
      Effect.succeed(retrievedUri ? [{ uri: retrievedUri, type: vscode.FileType.File }] : [])
    );

    const [{ artifact }] = await OrgCatalogRemoteRetrieve.materializeRetrievedComponents('00D000000000001', [
      { reference: { xmlName: 'Prompt', fullName: 'Property' }, expectedRemoteLastModifiedDate: 'revision-1' }
    ]).pipe(Effect.provide(layer), Effect.runPromise);

    expect(artifact.primaryUri.path.endsWith('/prompts/Property.prompt-meta.xml')).toBe(true);
    expect(artifact.fileUris).toEqual([artifact.primaryUri]);
  });
});
