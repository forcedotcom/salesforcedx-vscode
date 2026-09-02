/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { MetadataRetrieveService } from '../../../src/core/metadataRetrieveService';
import { ProjectService } from '../../../src/core/projectService';
import { OrgCatalogState } from '../../../src/orgCatalog/orgCatalogState';
import { OrgCatalogWorkspace } from '../../../src/orgCatalog/orgCatalogWorkspace';
import { OrgMetadataReferenceService } from '../../../src/orgCatalog/orgMetadataReference';

const objectMetadata = {
  CustomObject: {
    label: 'Broker',
    pluralLabel: 'Brokers'
  }
};

const fieldMetadata = {
  CustomField: {
    fullName: 'Account__c',
    label: 'Account',
    type: 'Lookup',
    referenceTo: 'Account'
  }
};

const createFixture = (eligible = true) => {
  const parseObject = jest.fn(async () => objectMetadata);
  const parseField = jest.fn(async () => fieldMetadata);
  const fieldComponent = {
    type: { name: 'CustomField' },
    fullName: 'Broker__c.Account__c',
    xml: '/workspace/force-app/main/default/objects/Broker__c/fields/Account__c.field-meta.xml',
    parseXml: parseField
  };
  const objectComponent = {
    type: { name: 'CustomObject' },
    fullName: 'Broker__c',
    xml: '/workspace/force-app/main/default/objects/Broker__c/Broker__c.object-meta.xml',
    parseXml: parseObject,
    getChildren: jest.fn(() => [fieldComponent])
  };
  const buildComponentSetFromSource = jest.fn(() =>
    Effect.succeed({ getSourceComponents: () => [objectComponent, fieldComponent] })
  );
  const dependencies = Layer.mergeAll(
    Layer.succeed(OrgCatalogState, {} as unknown as InstanceType<typeof OrgCatalogState>),
    Layer.succeed(OrgMetadataReferenceService, {} as unknown as InstanceType<typeof OrgMetadataReferenceService>),
    Layer.succeed(MetadataRetrieveService, {
      buildComponentSetFromSource
    } as unknown as InstanceType<typeof MetadataRetrieveService>),
    Layer.succeed(ProjectService, {
      getSfProject: () => Effect.succeed({ getPackageDirectories: () => [{ fullPath: '/workspace/force-app' }] }),
      isArtifactNamespaceWorkspaceEligible: () => Effect.succeed(eligible)
    } as unknown as InstanceType<typeof ProjectService>)
  );
  const layer = OrgCatalogWorkspace.DefaultWithoutDependencies.pipe(Layer.provide(dependencies));
  return { buildComponentSetFromSource, layer, parseField, parseObject };
};

describe('OrgCatalogWorkspace', () => {
  it('loads structured SObject metadata through SDR SourceComponent parsing', async () => {
    const fixture = createFixture();
    const result = await Effect.runPromise(
      OrgCatalogWorkspace.pipe(
        Effect.flatMap(service => service.loadSObjectMetadata({ kind: 'sobject', namespace: null, name: 'Broker__c' })),
        Effect.provide(fixture.layer)
      )
    );

    expect(result).toMatchObject({
      object: {
        fullName: 'Broker__c',
        metadata: objectMetadata
      },
      fields: [
        {
          fullName: 'Broker__c.Account__c',
          metadata: fieldMetadata
        }
      ]
    });
    expect(result?.object.definitionUri.toString()).toBe(
      'file:///workspace/force-app/main/default/objects/Broker__c/Broker__c.object-meta.xml'
    );
    expect(fixture.buildComponentSetFromSource).toHaveBeenCalledWith(
      ['/workspace/force-app'],
      [{ type: 'CustomObject', fullName: 'Broker__c' }]
    );
    expect(fixture.parseObject).toHaveBeenCalledTimes(1);
    expect(fixture.parseField).toHaveBeenCalledTimes(1);
  });

  it('does not attribute a mismatched namespace to the workspace', async () => {
    const fixture = createFixture(false);
    const result = await Effect.runPromise(
      OrgCatalogWorkspace.pipe(
        Effect.flatMap(service =>
          service.loadSObjectMetadata({ kind: 'sobject', namespace: 'OtherPackage', name: 'Broker__c' })
        ),
        Effect.provide(fixture.layer)
      )
    );

    expect(result).toBeNull();
    expect(fixture.buildComponentSetFromSource).not.toHaveBeenCalled();
  });
});
