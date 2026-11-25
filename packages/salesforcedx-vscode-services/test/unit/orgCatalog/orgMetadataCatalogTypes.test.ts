/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';
import {
  OrgMetadataCatalogComponentReferenceSchema,
  OrgMetadataCatalogEntrySchema
} from '../../../src/orgCatalog/orgMetadataCatalogTypes';

const isCatalogEntry = Schema.is(OrgMetadataCatalogEntrySchema);

describe('OrgMetadataCatalogEntrySchema', () => {
  const baseEntry = {
    orgId: '00D000000000001',
    observedAt: '2026-08-14T00:00:00.000Z',
    provenance: 'metadata-api' as const,
    name: 'Example',
    documentUri: URI.parse('sf-org-metadata:/orgs/00D000000000001/ApexClass/Example.cls'),
    inOrg: true,
    inWorkspace: false
  };

  it('accepts a component with a conventional type reference', () => {
    expect(
      isCatalogEntry({
        ...baseEntry,
        kind: 'component',
        reference: { type: 'ApexClass', fullName: 'Example' }
      })
    ).toBe(true);
  });

  it('accepts a component observed through the standard data query API', () => {
    expect(
      isCatalogEntry({
        ...baseEntry,
        provenance: 'data-api',
        kind: 'component',
        reference: { type: 'ApexClass', fullName: 'Example' }
      })
    ).toBe(true);
  });

  it('rejects a component without a full name', () => {
    expect(
      isCatalogEntry({
        ...baseEntry,
        kind: 'component',
        reference: { type: 'ApexClass' }
      })
    ).toBe(false);
  });
});

describe('OrgMetadataCatalogComponentReferenceSchema', () => {
  it('accepts canonical namespaced component full names', () => {
    expect(Schema.is(OrgMetadataCatalogComponentReferenceSchema)({ type: 'ApexClass', fullName: 'B__Foo' })).toBe(true);
  });
});
