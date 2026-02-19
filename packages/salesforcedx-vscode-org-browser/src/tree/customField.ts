/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { OrgBrowserTreeItem } from './orgBrowserNode';
import { CustomObjectField } from './types';

export const createCustomFieldNode =
  (projectComponentSet: ComponentSet) => (element: OrgBrowserTreeItem) =>
    Effect.fn('createCustomFieldNode')(function* (field: CustomObjectField) {
      return yield* Effect.sync(() => {
        const fieldFullName = `${element.componentName}.${removeNamespacePrefix(element)(field).name}`;
        const filePaths = projectComponentSet.getComponentFilenamesByNameAndType({
          fullName: fieldFullName,
          type: 'CustomField'
        });
        return new OrgBrowserTreeItem({
          kind: 'component',
          xmlName: 'CustomField',
          componentName: `${element.componentName}.${field.name}`,
          label: getFieldLabel(removeNamespacePrefix(element)(field)),
          filePresent: filePaths.length > 0
        });
      });
    });

/** build out the label for a CustomField */
const getFieldLabel = (f: CustomObjectField): string => {
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

const removeNamespacePrefix =
  (element: OrgBrowserTreeItem) =>
  (f: CustomObjectField): CustomObjectField =>
    element.namespace ? { ...f, name: f.name.replace(`${element.namespace}__`, '') } : f;
