/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import type { TypeInventory } from '../../../src/orgCatalog/orgCatalogInternalTypes';
import { mergeInventory, projectChildren } from '../../../src/orgCatalog/orgCatalogProjection';
import { OrgMetadataReferenceService } from '../../../src/orgCatalog/orgMetadataReference';

const referenceLayer = OrgMetadataReferenceService.DefaultWithoutDependencies.pipe(
  Layer.provide(
    Layer.succeed(MetadataRegistryService, {
      getRegistryAccess: () =>
        Effect.succeed({
          getTypeByName: () => ({ suffix: undefined })
        })
    } as unknown as InstanceType<typeof MetadataRegistryService>)
  )
);

const run = <A>(effect: Effect.Effect<A, unknown, OrgMetadataReferenceService>): A =>
  Effect.runSync(effect.pipe(Effect.provide(referenceLayer)));

describe('Org Catalog inventory projection', () => {
  it('merges remote observations with live workspace presence', () => {
    const workspaceUri = URI.file('/workspace/classes/Both.cls');
    const localOnlyUri = URI.file('/workspace/classes/LocalOnly.cls');
    const inventory = run(
      mergeInventory({
        orgId: 'org-one',
        xmlName: 'ApexClass',
        observedAt: '2026-08-03T12:00:00.000Z',
        orgComponents: [{ fullName: 'Both', lastModifiedDate: '2026-08-03T11:00:00.000Z' }, { fullName: 'RemoteOnly' }],
        workspaceUris: new Map([
          ['Both', workspaceUri],
          ['LocalOnly', localOnlyUri]
        ])
      })
    );

    expect(inventory.get('Both')).toMatchObject({
      provenance: 'metadata-api+workspace',
      inOrg: true,
      inWorkspace: true,
      workspaceUri,
      remoteLastModifiedDate: '2026-08-03T11:00:00.000Z'
    });
    expect(inventory.get('RemoteOnly')).toMatchObject({
      provenance: 'metadata-api',
      inOrg: true,
      inWorkspace: false
    });
    expect(inventory.get('LocalOnly')).toMatchObject({
      provenance: 'workspace',
      inOrg: false,
      inWorkspace: true,
      workspaceUri: localOnlyUri
    });
  });

  it('projects remote and workspace-only folder hierarchies one level at a time', () => {
    const components = run(
      mergeInventory({
        orgId: 'org-one',
        xmlName: 'Report',
        observedAt: '2026-08-03T12:00:00.000Z',
        orgComponents: [{ fullName: 'Sales/Quarterly' }],
        workspaceUris: new Map([['Local/Draft', URI.file('/workspace/reports/Local/Draft.report-meta.xml')]])
      })
    );
    const inventory: TypeInventory = {
      observedAt: '2026-08-03T12:00:00.000Z',
      complete: true,
      components,
      folders: new Map([['Sales', { fullName: 'Sales' }]])
    };

    expect(run(projectChildren('org-one', 'Report', undefined, inventory))).toEqual([
      expect.objectContaining({ name: 'Local', kind: 'folder', inOrg: false, inWorkspace: true }),
      expect.objectContaining({ name: 'Sales', kind: 'folder', inOrg: true, inWorkspace: false })
    ]);
    expect(run(projectChildren('org-one', 'Report', 'Sales', inventory))).toEqual([
      expect.objectContaining({ name: 'Quarterly', kind: 'component', inOrg: true })
    ]);
  });
});
