/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import {
  orgDataDocumentSelector,
  orgDataOwner,
  orgDataOwnerRoot,
  orgDataSegments,
  orgDataUri,
  orgRoot
} from '../../../src/orgVfs/orgDataUris';

describe('org-data URI helpers', () => {
  it('builds the org-first, owner-second layout with sanitized segments', () => {
    expect(orgRoot(' 00DABC ')).toEqual(URI.parse('sf-org-data:/orgs/00dabc'));
    expect(orgDataOwnerRoot({ orgKey: '00DABC', owner: 'apex-testing' })).toEqual(
      URI.parse('sf-org-data:/orgs/00dabc/apex-testing')
    );
    expect(
      orgDataUri({
        orgKey: '00DABC',
        owner: 'apex-testing',
        segments: ['classes', 'namespace', 'My Test.cls']
      })
    ).toEqual(
      URI.from({
        scheme: 'sf-org-data',
        path: '/orgs/00dabc/apex-testing/classes/namespace/My%20Test.cls'
      })
    );
  });

  it('returns relative segments only for the requested owner', () => {
    const uri = URI.parse('sf-org-data:/orgs/00d/apex-testing/classes/ns/MyTest.cls');

    expect(orgDataSegments(uri, 'apex-testing')).toEqual(['classes', 'ns', 'MyTest.cls']);
    expect(orgDataSegments(uri, 'metadata-preview')).toBeUndefined();
    expect(orgDataSegments(URI.file('/MyTest.cls'), 'apex-testing')).toBeUndefined();
  });

  it('identifies an org-data URI owner', () => {
    expect(orgDataOwner(URI.parse('sf-org-data:/orgs/00d/metadata-preview/ApexClass/Test.cls'))).toBe(
      'metadata-preview'
    );
    expect(orgDataOwner(URI.parse('sf-org-data:/orgs/00d/unknown/file'))).toBeUndefined();
  });

  it('creates an owner-scoped document selector', () => {
    expect(orgDataDocumentSelector({ owner: 'apex-testing', language: 'apex' })).toEqual({
      scheme: 'sf-org-data',
      language: 'apex',
      pattern: '/orgs/*/apex-testing/**'
    });
  });
});
