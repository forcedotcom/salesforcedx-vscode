/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalog, OrgMetadataCatalogEntry } from 'salesforcedx-vscode-services';
import * as Effect from 'effect/Effect';
import { discoverFullOrgMetadata } from '../../src/services/fullOrgDiscovery';

const type = (name: string) => ({ kind: 'type', reference: { type: name } }) as unknown as OrgMetadataCatalogEntry;
const component = (name: string) =>
  ({ kind: 'component', reference: { type: 'CustomObject', fullName: name } }) as unknown as OrgMetadataCatalogEntry;
const folder = (name: string) =>
  ({ kind: 'folder', reference: { type: 'Report', fullName: name } }) as unknown as OrgMetadataCatalogEntry;

describe('discoverFullOrgMetadata', () => {
  it('loads flat types, folder contents, and custom object fields', async () => {
    const getChildren = jest.fn((reference: { type?: string; fullName?: string } = {}) => {
      if (!reference.type) return Effect.succeed([type('ApexClass'), type('Report'), type('CustomObject')]);
      if (reference.type === 'Report' && !reference.fullName) return Effect.succeed([folder('Sales')]);
      if (reference.type === 'Report' && reference.fullName === 'Sales')
        return Effect.succeed([folder('Sales/Regional')]);
      if (reference.type === 'CustomObject' && !reference.fullName) return Effect.succeed([component('Broker__c')]);
      return Effect.succeed([]);
    });
    const progress: string[] = [];

    await Effect.runPromise(
      discoverFullOrgMetadata({ getChildren } as unknown as OrgMetadataCatalog, ({ completed, total }) => {
        progress.push(`${completed}/${total}`);
      })
    );

    expect(getChildren).toHaveBeenCalledWith({ type: 'ApexClass' });
    expect(getChildren).toHaveBeenCalledWith({ type: 'Report' });
    expect(getChildren).toHaveBeenCalledWith({ type: 'Report', fullName: 'Sales' });
    expect(getChildren).toHaveBeenCalledWith({ type: 'Report', fullName: 'Sales/Regional' });
    expect(getChildren).toHaveBeenCalledWith({ type: 'CustomObject' });
    expect(getChildren).toHaveBeenCalledWith({ type: 'CustomObject', fullName: 'Broker__c' });
    expect(progress).toContain('0/3');
    expect(progress).toContain('3/3');
  });
});
