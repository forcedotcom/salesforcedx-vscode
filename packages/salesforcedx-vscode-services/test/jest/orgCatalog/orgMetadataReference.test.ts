/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import {
  isOrgMetadataComponentReference,
  ORG_METADATA_SCHEME,
  orgIdFromOrgMetadataUri,
  OrgMetadataReferenceService
} from '../../../src/orgCatalog/orgMetadataReference';

describe('org metadata document references', () => {
  const registryAccess = new RegistryAccess();
  const referenceLayer = OrgMetadataReferenceService.DefaultWithoutDependencies.pipe(
    Layer.provide(
      Layer.succeed(MetadataRegistryService, {
        getRegistryAccess: () => Effect.succeed(registryAccess)
      } as unknown as InstanceType<typeof MetadataRegistryService>)
    )
  );

  const run = <A, E extends Error>(
    body: (service: InstanceType<typeof OrgMetadataReferenceService>) => Effect.Effect<A, E>
  ): A =>
    Effect.runSync(
      OrgMetadataReferenceService.pipe(
        Effect.flatMap(service => body(service).pipe(Effect.orDie)),
        Effect.provide(referenceLayer)
      )
    );

  it('round-trips an Apex class with an editor-friendly extension', () => {
    const uri = run(service =>
      service.documentUri({
        orgId: '00Dxx0000000001',
        xmlName: 'ApexClass',
        fullName: 'namespace.MyTest'
      })
    );

    expect(uri.scheme).toBe(ORG_METADATA_SCHEME);
    expect(uri.path.endsWith('/namespace.MyTest.cls')).toBe(true);
    expect(run(service => service.parseDocumentUri(uri))).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'ApexClass',
      fullName: 'namespace.MyTest'
    });
  });

  it('preserves foldered metadata names', () => {
    const uri = run(service =>
      service.documentUri({
        orgId: '00Dxx0000000001',
        xmlName: 'Report',
        fullName: 'Public Reports/Pipeline'
      })
    );

    expect(uri.path.endsWith('/Pipeline.report')).toBe(true);
    expect(run(service => service.parseDocumentUri(uri))).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'Report',
      fullName: 'Public Reports/Pipeline'
    });
  });

  it('round-trips metadata types returned by describe but missing from the SDR registry', () => {
    const uri = run(service =>
      service.documentUri({
        orgId: '00Dxx0000000001',
        xmlName: 'TagSet',
        fullName: 'Example'
      })
    );

    expect(uri.path.endsWith('/Example')).toBe(true);
    expect(run(service => service.parseDocumentUri(uri))).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'TagSet',
      fullName: 'Example'
    });
  });

  it('round-trips a registered xml suffix without truncating a full name ending in xml', () => {
    const uri = run(service =>
      service.documentUri({
        orgId: '00Dxx0000000001',
        xmlName: 'EmailServicesFunction',
        fullName: 'Inbound.xml'
      })
    );

    expect(uri.path.endsWith('/Inbound.xml.xml')).toBe(true);
    expect(run(service => service.parseDocumentUri(uri))).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'EmailServicesFunction',
      fullName: 'Inbound.xml'
    });
  });

  it('keeps the org ID as a direct path segment and encodes metadata name segments', () => {
    const uri = run(service =>
      service.documentUri({
        orgId: '00D-org_one',
        xmlName: 'Report',
        fullName: 'Public Reports/Pipeline & Forecast'
      })
    );

    expect(uri.toString()).toContain('/orgs/00D-org_one/');
    expect(uri.toString()).toContain('Public%20Reports/Pipeline%20%26%20Forecast.report');
  });

  it('rejects org IDs that are unsafe as path segments', () => {
    expect(() =>
      run(service => service.documentUri({ orgId: '00D/unsafe', xmlName: 'ApexClass', fullName: 'MyTest' } as never))
    ).toThrow('orgId');
    expect(
      run(service =>
        service.parseDocumentUri(URI.parse(`${ORG_METADATA_SCHEME}:/orgs/00D%20unsafe/ApexClass/MyTest.cls`))
      )
    ).toBeUndefined();
  });

  it('rejects unrelated and malformed URIs', () => {
    expect(run(service => service.parseDocumentUri(URI.file('/ApexClass/MyTest.cls')))).toBeUndefined();
    expect(
      run(service => service.parseDocumentUri(URI.parse(`${ORG_METADATA_SCHEME}:/ApexClass/MyTest.cls`)))
    ).toBeUndefined();
  });

  it('reads org id from the URI path without registry access', () => {
    expect(
      orgIdFromOrgMetadataUri(URI.parse(`${ORG_METADATA_SCHEME}:/orgs/00Dxx0000000001/ApexClass/MyTest.cls`))
    ).toBe('00Dxx0000000001');
    expect(orgIdFromOrgMetadataUri(URI.file('/ApexClass/MyTest.cls'))).toBeUndefined();
  });

  it('recognizes only complete, non-empty component references', () => {
    expect(isOrgMetadataComponentReference({ xmlName: 'ApexClass', fullName: 'MyTest' })).toBe(true);
    expect(isOrgMetadataComponentReference({ xmlName: 'ApexClass' })).toBe(false);
    expect(isOrgMetadataComponentReference({ xmlName: '', fullName: 'MyTest' })).toBe(false);
  });
});
