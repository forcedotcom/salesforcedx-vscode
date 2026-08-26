/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import type { TypeInventory } from '../../../src/orgCatalog/orgCatalogInternalTypes';
import { componentIdentity } from '../../../src/orgCatalog/orgCatalogKeys';
import { mergeInventory, projectChildren } from '../../../src/orgCatalog/orgCatalogProjection';

const entryUri = (orgId: string, xmlName: string, fullName: string): URI =>
  URI.parse(`sf-org-metadata:/orgs/${orgId}/${xmlName}/${fullName}`);

describe('Org Catalog inventory projection', () => {
  it('merges remote observations with live workspace presence', () => {
    const workspaceUri = URI.file('/workspace/classes/Both.cls');
    const localOnlyUri = URI.file('/workspace/classes/LocalOnly.cls');
    const inventory = mergeInventory({
      entryUri,
      orgId: 'org-one',
      xmlName: 'ApexClass',
      observedAt: '2026-08-03T12:00:00.000Z',
      orgComponents: [{ fullName: 'Both', lastModifiedDate: '2026-08-03T11:00:00.000Z' }, { fullName: 'RemoteOnly' }],
      workspaceUris: new Map([
        ['Both', workspaceUri],
        ['LocalOnly', localOnlyUri]
      ])
    });

    expect(inventory.get(componentIdentity({ xmlName: 'ApexClass', fullName: 'Both' }))).toMatchObject({
      provenance: 'metadata-api+workspace',
      inOrg: true,
      inWorkspace: true,
      workspaceUri,
      remoteLastModifiedDate: '2026-08-03T11:00:00.000Z'
    });
    expect(inventory.get(componentIdentity({ xmlName: 'ApexClass', fullName: 'RemoteOnly' }))).toMatchObject({
      provenance: 'metadata-api',
      inOrg: true,
      inWorkspace: false
    });
    expect(inventory.get(componentIdentity({ xmlName: 'ApexClass', fullName: 'LocalOnly' }))).toMatchObject({
      provenance: 'workspace',
      inOrg: false,
      inWorkspace: true,
      workspaceUri: localOnlyUri
    });
  });

  it('keeps a namespaced remote component separate from an ineligible unnamespaced workspace file', () => {
    const workspaceUri = URI.file('/workspace/classes/MyClass.cls');
    const inventory = mergeInventory({
      entryUri,
      orgId: 'org-one',
      xmlName: 'ApexClass',
      observedAt: '2026-08-03T12:00:00.000Z',
      orgComponents: [{ fullName: 'MyClass', namespacePrefix: 'InstalledPackage' }],
      workspaceUris: new Map([['MyClass', workspaceUri]]),
      workspaceNamespace: null
    });

    expect(inventory.size).toBe(2);
    expect(
      inventory.get(componentIdentity({ xmlName: 'ApexClass', fullName: 'MyClass' }, 'InstalledPackage'))
    ).toMatchObject({ namespacePrefix: 'InstalledPackage', inOrg: true, inWorkspace: false });
    expect(inventory.get(componentIdentity({ xmlName: 'ApexClass', fullName: 'MyClass' }, null))).toMatchObject({
      inOrg: false,
      inWorkspace: true,
      workspaceUri
    });
  });

  it('merges matching project and remote namespaces while preserving provider casing', () => {
    const workspaceUri = URI.file('/workspace/classes/MyClass.cls');
    const inventory = mergeInventory({
      entryUri,
      orgId: 'org-one',
      xmlName: 'ApexClass',
      observedAt: '2026-08-03T12:00:00.000Z',
      orgComponents: [{ fullName: 'MyClass', namespacePrefix: 'MyPackage' }],
      workspaceUris: new Map([['myclass', workspaceUri]]),
      workspaceNamespace: 'mypackage'
    });

    expect(inventory.size).toBe(1);
    expect(inventory.values().next().value).toMatchObject({
      namespacePrefix: 'MyPackage',
      reference: { xmlName: 'ApexClass', fullName: 'MyClass' },
      provenance: 'metadata-api+workspace',
      inOrg: true,
      inWorkspace: true,
      workspaceUri
    });
  });

  it('projects remote and workspace-only folder hierarchies one level at a time', () => {
    const components = mergeInventory({
      entryUri,
      orgId: 'org-one',
      xmlName: 'Report',
      observedAt: '2026-08-03T12:00:00.000Z',
      orgComponents: [{ fullName: 'Sales/Quarterly' }],
      workspaceUris: new Map([['Local/Draft', URI.file('/workspace/reports/Local/Draft.report-meta.xml')]])
    });
    const inventory: TypeInventory = {
      observedAt: '2026-08-03T12:00:00.000Z',
      complete: true,
      components,
      folders: new Map([['Sales', { fullName: 'Sales' }]])
    };

    expect(projectChildren(entryUri, 'org-one', 'Report', undefined, inventory)).toEqual([
      expect.objectContaining({ name: 'Local', kind: 'folder', inOrg: false, inWorkspace: true }),
      expect.objectContaining({ name: 'Sales', kind: 'folder', inOrg: true, inWorkspace: false })
    ]);
    expect(projectChildren(entryUri, 'org-one', 'Report', 'Sales', inventory)).toEqual([
      expect.objectContaining({ name: 'Quarterly', kind: 'component', inOrg: true })
    ]);
  });
});
