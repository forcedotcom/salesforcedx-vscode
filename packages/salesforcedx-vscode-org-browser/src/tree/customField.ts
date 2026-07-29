/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgMetadataFieldDetails, OrgMetadataInventoryEntry } from 'salesforcedx-vscode-services';
import { OrgBrowserTreeItem } from './orgBrowserNode';

export const createCustomFieldNode = (
  entry: OrgMetadataInventoryEntry & { readonly fullName: string; readonly field: OrgMetadataFieldDetails }
): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: 'component',
    xmlName: 'CustomField',
    componentName: entry.fullName,
    label: getFieldLabel(entry.field),
    filePresent: entry.inWorkspace,
    orgPresent: entry.inOrg
  });

/** build out the label for a CustomField */
const getFieldLabel = (f: OrgMetadataFieldDetails): string => {
  switch (f.type) {
    case 'string':
    case 'textarea':
    case 'email':
      return `${f.name} | ${f.type} | length: ${f.length?.toLocaleString()}`;
    case 'reference':
      return `${f.relationshipName} | reference`;
    case 'double':
    case 'currency':
    case 'percent':
      return `${f.name} | ${f.type} | scale: ${f.scale} | precision: ${f.precision}`;
    default:
      return `${f.name} | ${f.type}`;
  }
};
