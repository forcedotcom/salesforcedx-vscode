/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import {
  ORG_METADATA_SCHEME,
  orgMetadataDocumentUri,
  parseOrgMetadataDocumentUri
} from '../../../src/orgCatalog/orgMetadataReference';

describe('org metadata document references', () => {
  it('round-trips an Apex class with an editor-friendly extension', () => {
    const uri = orgMetadataDocumentUri({
      orgId: '00Dxx0000000001',
      xmlName: 'ApexClass',
      fullName: 'namespace.MyTest'
    });

    expect(uri.scheme).toBe(ORG_METADATA_SCHEME);
    expect(uri.path.endsWith('/namespace.MyTest.cls')).toBe(true);
    expect(parseOrgMetadataDocumentUri(uri)).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'ApexClass',
      fullName: 'namespace.MyTest'
    });
  });

  it('preserves foldered metadata names', () => {
    const uri = orgMetadataDocumentUri({
      orgId: '00Dxx0000000001',
      xmlName: 'Report',
      fullName: 'Public Reports/Pipeline'
    });

    expect(parseOrgMetadataDocumentUri(uri)).toEqual({
      orgId: '00Dxx0000000001',
      xmlName: 'Report',
      fullName: 'Public Reports/Pipeline'
    });
  });

  it('rejects unrelated and malformed URIs', () => {
    expect(parseOrgMetadataDocumentUri(URI.file('/ApexClass/MyTest.cls'))).toBeUndefined();
    expect(parseOrgMetadataDocumentUri(URI.parse(`${ORG_METADATA_SCHEME}:/ApexClass/MyTest.cls`))).toBeUndefined();
  });
});
