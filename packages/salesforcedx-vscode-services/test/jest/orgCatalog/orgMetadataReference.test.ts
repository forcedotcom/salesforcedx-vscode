/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { URI } from 'vscode-uri';
import {
  isOrgMetadataComponentReference,
  ORG_METADATA_SCHEME,
  orgMetadataDocumentUri,
  parseOrgMetadataDocumentUri
} from '../../../src/orgCatalog/orgMetadataReference';

describe('org metadata document references', () => {
  const registryAccess = new RegistryAccess();

  it('round-trips an Apex class with an editor-friendly extension', () => {
    const uri = orgMetadataDocumentUri(registryAccess, {
      orgId: '00Dxx0000000001',
      xmlName: 'ApexClass',
      fullName: 'namespace.MyTest'
    });

    expect(uri.scheme).toBe(ORG_METADATA_SCHEME);
    expect(uri.path.endsWith('/namespace.MyTest.cls')).toBe(true);
    expect(parseOrgMetadataDocumentUri(registryAccess, uri)).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'ApexClass',
      fullName: 'namespace.MyTest'
    });
  });

  it('preserves foldered metadata names', () => {
    const uri = orgMetadataDocumentUri(registryAccess, {
      orgId: '00Dxx0000000001',
      xmlName: 'Report',
      fullName: 'Public Reports/Pipeline'
    });

    expect(uri.path.endsWith('/Pipeline.report')).toBe(true);
    expect(parseOrgMetadataDocumentUri(registryAccess, uri)).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'Report',
      fullName: 'Public Reports/Pipeline'
    });
  });

  it('round-trips metadata types returned by describe but missing from the SDR registry', () => {
    const uri = orgMetadataDocumentUri(registryAccess, {
      orgId: '00Dxx0000000001',
      xmlName: 'TagSet',
      fullName: 'Example'
    });

    expect(uri.path.endsWith('/Example.xml')).toBe(true);
    expect(parseOrgMetadataDocumentUri(registryAccess, uri)).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'TagSet',
      fullName: 'Example'
    });
  });

  it('rejects unrelated and malformed URIs', () => {
    expect(parseOrgMetadataDocumentUri(registryAccess, URI.file('/ApexClass/MyTest.cls'))).toBeUndefined();
    expect(
      parseOrgMetadataDocumentUri(registryAccess, URI.parse(`${ORG_METADATA_SCHEME}:/ApexClass/MyTest.cls`))
    ).toBeUndefined();
  });

  it('recognizes only complete, non-empty component references', () => {
    expect(isOrgMetadataComponentReference({ xmlName: 'ApexClass', fullName: 'MyTest' })).toBe(true);
    expect(isOrgMetadataComponentReference({ xmlName: 'ApexClass' })).toBe(false);
    expect(isOrgMetadataComponentReference({ xmlName: '', fullName: 'MyTest' })).toBe(false);
  });
});
