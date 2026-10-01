/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgMetadataCatalogComponentEntry } from 'salesforcedx-vscode-services';
import { URI } from 'vscode-uri';
import { fieldNodeLabel } from '../../src/tree/customField';

const component = (overrides: Partial<OrgMetadataCatalogComponentEntry> = {}): OrgMetadataCatalogComponentEntry => ({
  kind: 'component',
  orgId: '00D000000000001',
  observedAt: '2026-09-18T00:00:00.000Z',
  provenance: 'metadata-api',
  name: 'Email__c',
  documentUri: URI.parse('sf-org-metadata:/orgs/00D000000000001/CustomField/Broker__c.Email__c.field'),
  inOrg: true,
  inWorkspace: false,
  reference: { type: 'CustomField', fullName: 'Broker__c.Email__c' },
  ...overrides
});

describe('fieldNodeLabel', () => {
  it('labels inventory-only fields by catalog name', () => {
    expect(fieldNodeLabel(component())).toBe('Email__c');
  });

  it('labels described fields with type details', () => {
    expect(
      fieldNodeLabel(component({ field: { name: 'Email__c', type: 'string', length: 80, relationshipName: null } }))
    ).toBe('Email__c | string | length: 80');
  });
});
