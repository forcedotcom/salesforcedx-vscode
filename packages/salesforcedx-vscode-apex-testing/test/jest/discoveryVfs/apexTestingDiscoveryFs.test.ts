/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import { getApexTestingClassUri, isForeignOrgClassUri } from '../../../src/discoveryVfs/apexTestingDiscoveryFs';

describe('isForeignOrgClassUri', () => {
  // org keys are sanitized (trim + lower-case + encodeURIComponent) into the path segment.
  const orgAUri = getApexTestingClassUri('00DAAA', 'MyTest');
  const orgBUri = getApexTestingClassUri('00DBBB', 'OtherTest');

  it('is false for non apex-testing: schemes', () => {
    expect(isForeignOrgClassUri(URI.file('/workspace/MyTest.cls'), '00daaa')).toBe(false);
    expect(isForeignOrgClassUri(URI.parse('sf-org-apex:MyTest.cls'), '00daaa')).toBe(false);
  });

  it('is false for the current org tab (case-insensitive match)', () => {
    // saved key was 00DAAA, sanitized to 00daaa; passing either casing still matches as current.
    expect(isForeignOrgClassUri(orgAUri, '00DAAA')).toBe(false);
    expect(isForeignOrgClassUri(orgAUri, '00daaa')).toBe(false);
  });

  it('is true for a different orgs tab', () => {
    expect(isForeignOrgClassUri(orgBUri, '00DAAA')).toBe(true);
  });

  it('treats every org tab as foreign when there is no current org (logout)', () => {
    expect(isForeignOrgClassUri(orgAUri, undefined)).toBe(true);
    expect(isForeignOrgClassUri(orgBUri, undefined)).toBe(true);
  });

  it('is false for apex-testing: URIs outside the /orgs/<org> shape', () => {
    expect(isForeignOrgClassUri(URI.parse('apex-testing:/orgs'), undefined)).toBe(false);
    expect(isForeignOrgClassUri(URI.parse('apex-testing:/something/else'), undefined)).toBe(false);
  });
});
