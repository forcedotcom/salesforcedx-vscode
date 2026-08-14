/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgMetadataCatalogFieldEntry, OrgMetadataFieldDetails } from 'salesforcedx-vscode-services';
import { OrgBrowserTreeItem } from './orgBrowserNode';

export const createCustomFieldNode = (entry: OrgMetadataCatalogFieldEntry): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({
    kind: 'component',
    xmlName: 'CustomField',
    componentName: entry.reference.fullName,
    label: getFieldLabel(entry.field),
    filePresent: entry.inWorkspace,
    orgPresent: entry.inOrg
  });

/** build out the label for a CustomField */
const getFieldLabel = (field: OrgMetadataFieldDetails): string => {
  switch (field.type) {
    case 'string':
    case 'textarea':
    case 'email':
      return `${field.name} | ${field.type} | length: ${field.length?.toLocaleString()}`;
    case 'reference':
      return `${field.relationshipName} | reference`;
    case 'double':
    case 'currency':
    case 'percent':
      return `${field.name} | ${field.type} | scale: ${field.scale} | precision: ${field.precision}`;
    default:
      return `${field.name} | ${field.type}`;
  }
};
