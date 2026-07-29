/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import { URI } from 'vscode-uri';
import { orgDataSegments } from 'salesforcedx-vscode-services/src/orgVfs/orgDataUris';
import { orgMetadataUri } from 'salesforcedx-vscode-services/src/orgVfs/orgMetadataUris';
import { apexClassName, apexClassUri } from '../../../src/discoveryVfs/apexClassUri';

const api = {
  services: {
    orgDataSegments,
    orgMetadataUri
  }
} as unknown as SalesforceVSCodeServicesApi;

describe('apexClassUri', () => {
  it('uses the canonical org-metadata ApexClass key', () => {
    const uri = apexClassUri(api, '00DABC', 'namespace.MyTest');

    expect(uri).toEqual(URI.parse('sf-org-data:/orgs/00dabc/org-metadata/ApexClass/namespace.MyTest'));
    expect(apexClassName(api, uri)).toBe('namespace.MyTest');
  });

  it('rejects local and non-Apex metadata URIs', () => {
    expect(apexClassName(api, URI.file('/MyTest.cls'))).toBeUndefined();
    expect(
      apexClassName(api, URI.parse('sf-org-data:/orgs/00dabc/org-metadata/ApexTrigger/MyTrigger'))
    ).toBeUndefined();
  });
});
